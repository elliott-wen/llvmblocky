import * as llvm from "llvm-node";
import * as et from "elementtree";
import * as fs from "fs";

const XML_INPUT_PATH = "sample.xml";
const GLOBAL_INTEGER_TYPE = 0;
const GLOBAL_DOUBLE_TYPE = 1;
const GLOBAL_STATIC_TEXT_TYPE = 2;
const GLOBAL_HEAP_TEXT_TYPE = 3;

function loadXMLFile(path: string): et.ElementTree {
    const xmlString = fs.readFileSync(path, {encoding: 'utf-8'});
    const etree = et.parse(xmlString);
    return etree;
}

function sanitizeVariableName(str: string | undefined): string {
    if (!str) {
        throw Error('Unexpected empty variable name');
    }
    str = "id_" + str.replace(/[^a-z0-9._-]/gim, "_");
    return str.trim();
}

function sanitizeBlockName(id_str: string | undefined, type_str: string | undefined): string {
    if (!id_str || !type_str) {
        throw Error('Unexpected block name');
    }
    return "bl_" + (id_str + '__' + type_str).replace(/[^a-z0-9._-]/gim, "_");
}

class BlockyCompiler {
    globalMap = new Map<string, llvm.GlobalVariable>();
    context: llvm.LLVMContext;
    _module: llvm.Module;
    int8Ty: llvm.IntegerType;
    int64Ty: llvm.IntegerType;
    doubleTy: llvm.Type;
    int8PtrTy: llvm.PointerType;
    globalStructTy: llvm.StructType;
    builder: llvm.IRBuilder;
    mainFn: llvm.Function;

    constructor() {
        this.context = new llvm.LLVMContext();
        this._module = new llvm.Module("blockyllvm", this.context);
        this.int8Ty = llvm.Type.getInt8Ty(this.context);
        this.int64Ty = llvm.Type.getInt64Ty(this.context);
        this.doubleTy = llvm.Type.getDoubleTy(this.context);
        this.int8PtrTy = llvm.Type.getInt8PtrTy(this.context);
        this.globalStructTy = llvm.StructType.get(this.context, [this.int64Ty, this.doubleTy, this.int8PtrTy, this.int8Ty]);
        const mainFnTy = llvm.FunctionType.get(llvm.Type.getVoidTy(this.context), false);
        this.mainFn = llvm.Function.create(mainFnTy, llvm.LinkageTypes.ExternalLinkage, "main", this._module);
        const mainEntry = llvm.BasicBlock.create(this.context, "entry", this.mainFn);
        this.builder = new llvm.IRBuilder(mainEntry);
    }

    compileGlobals(ast: et.ElementTree): void {
        const globals = ast.findall('./variables/variable');
        for (const g of globals) {
            const gid = sanitizeVariableName(g['attrib']['id']);
            const gvar = new llvm.GlobalVariable(this._module, this.globalStructTy, false, llvm.LinkageTypes.InternalLinkage, llvm.Constant.getNullValue(this.globalStructTy), gid);
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
        const textID = sanitizeVariableName(astblock['attrib']['id']);
        const literalStr = literal.toString();
        const utf8Array = new TextEncoder().encode(literalStr);
        const utf8ArrayType = llvm.ArrayType.get(this.int8Ty, utf8Array.byteLength + 1);
        const textGlobalVar = new llvm.GlobalVariable(this._module, utf8ArrayType, false, llvm.LinkageTypes.InternalLinkage, llvm.ConstantDataArray.getString(this.context, literalStr), textID);
        this.globalMap.set(textID, textGlobalVar);

        return textGlobalVar;
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
        console.log(this.builder.createAlloca(this.int8Ty));
        if (blockValue.type.isPointerTy()) { /* Global var, we directly interpret it as an i8 byte. */
            const globalVarPtr = this.builder.createLoad(blockValue);
            const globalVar = this.builder.createLoad(globalVarPtr);
            return this.builder.createNeg(globalVar);
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

    compileVariableSet(astblock: et.Element): llvm.Value | undefined {
        return undefined;
    }

    compileBlock(astblock: et.Element): llvm.Value | undefined {
        const blockType = astblock['attrib']['type'];

        if (blockType === "math_number") {
            return this.compileMathNumber(astblock);
        } else if (blockType === "logic_boolean") {
            return this.compileLogicBoolean(astblock);
        } else if (blockType === "math_constant") {
            return this.compileMathConstant(astblock);
        } else if (blockType === "logic_negate") {
            return this.compileLogicNegate(astblock);
        } else if (blockType === "variables_get") {
            return this.compileVariableGet(astblock);
        } else if (blockType === "text") {
            return this.compileText(astblock);
        } else {
            console.error("Not implemented " + blockType);
        }
    }

    compile(ast: et.ElementTree) {
        this.compileGlobals(ast);

        const blocks = ast.findall('./block');
        for (const block of blocks) {
            this.compileBlock(block);
        }

        const exitBlock = llvm.BasicBlock.create(this.context, "exit", this.mainFn);
        this.builder.createBr(exitBlock);
        this.builder.setInsertionPoint(exitBlock);
        this.builder.createRetVoid();

        const ll = this._module.print();
        console.log(ll);

        llvm.verifyModule(this._module);
    }
}


function main() {
    const ast = loadXMLFile(XML_INPUT_PATH);
    const bl = new BlockyCompiler();
    bl.compile(ast);
}

main()

