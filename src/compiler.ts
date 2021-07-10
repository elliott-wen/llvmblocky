import * as llvm from "llvm-node";
import * as et from "elementtree";
import {GlobalVariable, PointerType} from "llvm-node";


enum VariableType {
    GLOBAL_INTEGER_TYPE,
    GLOBAL_DOUBLE_TYPE,
    GLOBAL_STATIC_TEXT_TYPE,
    GLOBAL_HEAP_TEXT_TYPE,
}

const GLOBAL_ID_PREFIX = "_G_ID_";


function sanitizeVariableName(str: string | undefined): string {
    if (!str) {
        throw Error('Unexpected empty variable name');
    }
    str = GLOBAL_ID_PREFIX + str.replace(/[^a-z0-9._-]/gim, "_");
    return str.trim();
}

function isGlobalVariable(blockValue: llvm.Value) {
    return blockValue instanceof llvm.GlobalVariable && blockValue.hasName() && blockValue.name.startsWith(GLOBAL_ID_PREFIX);
}

function isConstString(val: llvm.Value) {
    return val instanceof llvm.GlobalVariable && val.type.isPointerTy()
        && (val.type as PointerType).elementType.isArrayTy() && (val as GlobalVariable).constant;
}

export class BlockyCompiler {
    globalMap = new Map<string, llvm.GlobalVariable>();
    context: llvm.LLVMContext;
    _module: llvm.Module;
    int8Ty: llvm.IntegerType;
    int64Ty: llvm.IntegerType;
    voidTy: llvm.Type;
    doubleTy: llvm.Type;
    int8PtrTy: llvm.PointerType;
    globalStructTy: llvm.StructType;
    builder: llvm.IRBuilder;
    mainFn: llvm.Function;
    trapEntry: llvm.BasicBlock | undefined;
    exitEntry: llvm.BasicBlock;
    printCharArrayCall: llvm.Function | undefined;
    printDoubleCall: llvm.Function | undefined;
    printIntegerCall: llvm.Function | undefined;
    printGlobalCall: llvm.Function | undefined;

    constructor() {
        this.context = new llvm.LLVMContext();
        this._module = new llvm.Module("blockyllvm", this.context);
        this.int8Ty = llvm.Type.getInt8Ty(this.context);
        this.int64Ty = llvm.Type.getInt64Ty(this.context);
        this.doubleTy = llvm.Type.getDoubleTy(this.context);
        this.int8PtrTy = llvm.Type.getInt8PtrTy(this.context);
        this.voidTy = llvm.Type.getVoidTy(this.context);
        this.globalStructTy = llvm.StructType.get(this.context, [this.int64Ty, this.doubleTy, this.int8PtrTy, this.int8Ty]);
        const mainFnTy = llvm.FunctionType.get(llvm.Type.getVoidTy(this.context), false);
        this.mainFn = llvm.Function.create(mainFnTy, llvm.LinkageTypes.ExternalLinkage, "main", this._module);
        const mainEntry = llvm.BasicBlock.create(this.context, "entry", this.mainFn);
        this.exitEntry = llvm.BasicBlock.create(this.context, "exit", this.mainFn);
        this.builder = new llvm.IRBuilder(mainEntry);
    }

    _enforceVariableType(typeVariable: llvm.Value, expectedType: VariableType): void {
        const cond = this.builder.createICmpNE(typeVariable, llvm.ConstantInt.get(this.context, expectedType, 8));
        const nextEntry = llvm.BasicBlock.create(this.context, "type_enforce_success_" + expectedType, this.mainFn);
        if (!this.trapEntry) {
            this.trapEntry = llvm.BasicBlock.create(this.context, "trap", this.mainFn);
        }
        this.builder.createCondBr(cond, this.trapEntry, nextEntry);
        this.builder.setInsertionPoint(nextEntry);
    }

    compileGlobals(ast: et.ElementTree): void {
        const globals = ast.findall('./variables/variable');
        for (const g of globals) {
            const gid = sanitizeVariableName(g['attrib']['id']);
            const gvar = new llvm.GlobalVariable(this._module, this.globalStructTy, false, llvm.LinkageTypes.PrivateLinkage, llvm.Constant.getNullValue(this.globalStructTy), gid);
            this.globalMap.set(gid, gvar);
        }
    }

    /* IsLeaf: yes */
    compileLogicBoolean(astblock: et.Element): llvm.Value {
        const numText = astblock.findtext('./field');
        if (numText === "TRUE") {
            return llvm.ConstantInt.get(this.context, 1, 64);
        } else {
            return llvm.ConstantInt.get(this.context, 0, 64);
        }
    }

    /* IsLeaf: yes */
    compileMathConstant(astblock: et.Element): llvm.Value {
        const numText = astblock.findtext('./field');
        if (numText === 'PI') {
            return llvm.ConstantFP.get(this.context, 3.1415926);
        }
        throw Error('Unexpected math constant');
    }

    /* IsLeaf: yes */
    compileMathNumber(astblock: et.Element): llvm.Value {
        const numText = astblock.findtext('./field');
        const digiNum = Number(numText);

        if (isNaN(digiNum)) {
            throw Error('Unexpected math number');
        }

        if (Number.isInteger(digiNum)) {
            return llvm.ConstantInt.get(this.context, digiNum, 64);

        } else {
            return llvm.ConstantFP.get(this.context, digiNum);
        }
    }

    /* IsLeaf: yes */
    compileText(astblock: et.Element): llvm.Value {
        const literal = astblock.findtext('./field');
        if (!literal) {
            throw Error('Unexpected text literal');
        }
        const literalStr = literal.toString();
        const res = this.builder.createGlobalString(literalStr);
        return res;
    }

    /* IsLeaf: no */
    compileLogicNegate(astblock: et.Element): llvm.Value {
        const value = astblock.find("./value/block");
        if (!value) {
            console.error("Missing operand in logic negate, return 1 by default");
            return llvm.ConstantInt.get(this.context, 1, 64);
        }
        const blockValue = this.compileBlock(value);
        if (!blockValue) {
            throw Error("Expecting operand in logic negate");
        }

        if (blockValue.type.isIntegerTy()) {
            return this.builder.createNeg(blockValue);
        }

        if (isGlobalVariable(blockValue)) { /* Global var, we directly interpret it as an i8 byte. */
            const typePtr = this.builder.createInBoundsGEP(blockValue, [llvm.ConstantInt.get(this.context, 0), llvm.ConstantInt.get(this.context, 3)], "type");
            const loadedType = this.builder.createLoad(typePtr);
            this._enforceVariableType(loadedType, VariableType.GLOBAL_INTEGER_TYPE);
            const intPtr = this.builder.createInBoundsGEP(blockValue, [llvm.ConstantInt.get(this.context, 0), llvm.ConstantInt.get(this.context, 0)], "integer");
            const intStuff = this.builder.createLoad(intPtr)
            return this.builder.createNeg(intStuff);
        }
        throw Error("Expecting int operand in logic negate");
    }

    compileVariableGet(astblock: et.Element): llvm.Value {
        const varField = astblock.find("./field");
        if (!varField) {
            throw Error("Expecting operand in Variable Get");
        }
        const varName = sanitizeVariableName(varField['attrib']['id']);
        const globalVarPtr = this.globalMap.get(varName);
        if (!globalVarPtr) {
            throw Error("Unknown Variable in Variable Get");
        }
        return globalVarPtr;
    }

    compileTextPrint(astblock: et.Element) {
        const valBlock = astblock.find('./value/block');
        const printCharArrayFnTy = llvm.FunctionType.get(this.voidTy, [this.int8PtrTy], false);
        const printDoubleFnTy = llvm.FunctionType.get(this.voidTy, [this.doubleTy], false);
        const printIntegerFnTy = llvm.FunctionType.get(this.voidTy, [this.int64Ty], false);
        const printGlobalFnTy = llvm.FunctionType.get(this.voidTy, [this.int8PtrTy], false);

        if (!this.printCharArrayCall) {

            this.printCharArrayCall = llvm.Function.create(printCharArrayFnTy, llvm.LinkageTypes.ExternalLinkage, "_printConstString", this._module);
        }

        if (!this.printDoubleCall) {

            this.printDoubleCall = llvm.Function.create(printDoubleFnTy, llvm.LinkageTypes.ExternalLinkage, "_printDouble", this._module);
        }

        if (!this.printIntegerCall) {

            this.printIntegerCall = llvm.Function.create(printIntegerFnTy, llvm.LinkageTypes.ExternalLinkage, "_printInteger", this._module);
        }

        if (!this.printGlobalCall) {

            this.printGlobalCall = llvm.Function.create(printGlobalFnTy, llvm.LinkageTypes.ExternalLinkage, "_printGlobal", this._module);
        }


        if (!valBlock) {
            const shadowBlock = astblock.find('./value/shadow');
            if (!shadowBlock) {
                throw Error("Empty shadow text block");
            }
            const printText = this.compileText(shadowBlock);
            const printTextPtr = this.builder.createBitCast(printText, this.int8PtrTy);
            this.builder.createCall(printCharArrayFnTy, this.printCharArrayCall, [printTextPtr]);
        } else {
            const printText = this.compileBlock(valBlock);
            if (!printText) {
                throw Error("Empty text val");
            }
            if (isGlobalVariable(printText)) { /* Global var, we directly interpret it as an i8 byte. */
                const printTextPtr = this.builder.createBitCast(printText, this.int8PtrTy);
                this.builder.createCall(printGlobalFnTy, this.printGlobalCall, [printTextPtr]);
            } else if (printText.type.isDoubleTy()) {
                this.builder.createCall(printDoubleFnTy, this.printDoubleCall, [printText]);
            } else if (printText.type.isIntegerTy()) {
                this.builder.createCall(printIntegerFnTy, this.printIntegerCall, [printText]);
            } else if (isConstString(printText)) {
                const printTextPtr = this.builder.createBitCast(printText, this.int8PtrTy);
                this.builder.createCall(printCharArrayFnTy, this.printCharArrayCall, [printTextPtr]);
            } else {
                throw Error("Unknown Type in text printing")
            }

        }
    }

    compileVariableSet(astblock: et.Element) {
        const varField = astblock.find("./field");
        if (!varField) {
            throw Error("Expecting operand in Variable Get");
        }
        const varName = sanitizeVariableName(varField['attrib']['id']);
        const destVarPtr = this.globalMap.get(varName);
        if (!destVarPtr) {
            throw Error("Variable not defined.");
        }
        const valBlock = astblock.find('./value/block');
        if (!valBlock) {
            throw Error("Value not found in set variable.");
        }
        const sourceVal = this.compileBlock(valBlock);
        if (!sourceVal) {
            throw Error("Value not found in set variable.");
        }
        if (isGlobalVariable(sourceVal)) { /* Global var copy */
            const globalVariableCopyFnTy = llvm.FunctionType.get(this.voidTy, [this.int8PtrTy, this.int8PtrTy], false);
            const globalVariableCopyCall = llvm.Function.create(globalVariableCopyFnTy, llvm.LinkageTypes.ExternalLinkage, "_globalVariableCopy", this._module);
            const castedSrc = this.builder.createBitCast(sourceVal, this.int8PtrTy);
            const castedDst = this.builder.createBitCast(destVarPtr, this.int8PtrTy);
            this.builder.createCall(globalVariableCopyFnTy, globalVariableCopyCall, [castedDst, castedSrc]);
        } else if (sourceVal.type.isDoubleTy()) {
            const typePtr = this.builder.createInBoundsGEP(destVarPtr, [llvm.ConstantInt.get(this.context, 0), llvm.ConstantInt.get(this.context, 3)], "type");
            const doublePtr = this.builder.createInBoundsGEP(destVarPtr, [llvm.ConstantInt.get(this.context, 0), llvm.ConstantInt.get(this.context, 1)], "double");
            this.builder.createStore(llvm.ConstantInt.get(this.context, VariableType.GLOBAL_DOUBLE_TYPE, 8), typePtr);
            this.builder.createStore(sourceVal, doublePtr);
        } else if (sourceVal.type.isIntegerTy()) {
            const typePtr = this.builder.createInBoundsGEP(destVarPtr, [llvm.ConstantInt.get(this.context, 0), llvm.ConstantInt.get(this.context, 3)], "type");
            const doublePtr = this.builder.createInBoundsGEP(destVarPtr, [llvm.ConstantInt.get(this.context, 0), llvm.ConstantInt.get(this.context, 0)], "integer");
            this.builder.createStore(llvm.ConstantInt.get(this.context, VariableType.GLOBAL_INTEGER_TYPE, 8), typePtr);
            this.builder.createStore(sourceVal, doublePtr);
        } else if (isConstString(sourceVal)) {
            const typePtr = this.builder.createInBoundsGEP(destVarPtr, [llvm.ConstantInt.get(this.context, 0), llvm.ConstantInt.get(this.context, 3)], "type");
            const memPtr = this.builder.createInBoundsGEP(destVarPtr, [llvm.ConstantInt.get(this.context, 0), llvm.ConstantInt.get(this.context, 2)], "mem");
            this.builder.createStore(llvm.ConstantInt.get(this.context, VariableType.GLOBAL_STATIC_TEXT_TYPE, 8), typePtr);
            const castedPtr = this.builder.createBitCast(sourceVal, this.int8PtrTy);
            this.builder.createStore(castedPtr, memPtr);
        } else {
            throw Error("Unknown Type in variable setting")
        }
    }

    compileBlock(astblock: et.Element): llvm.Value | undefined {
        const blockType = astblock['attrib']['type'];
        let res: llvm.Value | undefined = undefined;
        if (blockType === "math_number") {
            res = this.compileMathNumber(astblock);
        } else if (blockType === "logic_boolean") {
            res = this.compileLogicBoolean(astblock);
        } else if (blockType === "math_constant") {
            res = this.compileMathConstant(astblock);
        } else if (blockType === "logic_negate") {
            res = this.compileLogicNegate(astblock);
        } else if (blockType === "variables_get") {
            res = this.compileVariableGet(astblock);
        } else if (blockType === "text") {
            res = this.compileText(astblock);
        } else if (blockType === "variables_set") {
            this.compileVariableSet(astblock);
        } else if (blockType === "text_print") {
            this.compileTextPrint(astblock);
        } else {
            throw Error('Type not implemented ' + blockType);
        }

        const nextBlock = astblock.find('./next');
        if (nextBlock) {
            this.compileBlock(nextBlock);
        }

        return res;
    }

    compile(xmlString: string) {
        const ast = et.parse(xmlString);
        this.compileGlobals(ast);

        // Compile Top-level block
        const blocks = ast.findall('./block');
        for (const block of blocks) {
            this.compileBlock(block);
        }
        this.builder.createBr(this.exitEntry);

        // Trap Entry
        if (this.trapEntry) {
            this.builder.setInsertionPoint(this.trapEntry);
            const trapFnTy = llvm.FunctionType.get(this.voidTy, false);
            const trapCall = llvm.Function.create(trapFnTy, llvm.LinkageTypes.ExternalLinkage, "llvm.trap", this._module);
            trapCall.addFnAttr(llvm.Attribute.AttrKind.NoReturn);
            this.builder.createCall(trapFnTy, trapCall, []);
            this.builder.createBr(this.exitEntry);
        }

        // Exit Entry
        this.builder.setInsertionPoint(this.exitEntry);
        this.builder.createRetVoid();

        // Verify and Print
        llvm.verifyModule(this._module);
        const ll = this._module.print();
        return ll;
    }
}




