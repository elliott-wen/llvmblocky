import * as llvm from "llvm-node";
import * as et from "elementtree";
import * as fs from "fs";

const XML_INPUT_PATH = "sample.xml";

const GLOBAL_INTEGER_TYPE = 0
const GLOBAL_DOUBLE_TYPE = 1
const GLOBAL_TEXT_TYPE = 2

const globalMap = new Map<string, llvm.GlobalVariable>();

function sanitizeVariableName(str: string | undefined): string {
	if (!str) {
		throw Error('Unexpected variable name');
	}
	str = "id_" + str.replace(/[^a-z0-9._-]/gim, "_");
	return str.trim();
}

function loadXMLFile(path: string): et.ElementTree {
	const xmlString = fs.readFileSync(path, { encoding: 'utf-8' });
	const etree = et.parse(xmlString);
	return etree;
}

function compileGlobals(context: llvm.LLVMContext, _module: llvm.Module, ast: et.ElementTree) {
	const intType = llvm.Type.getInt32Ty(context);
	const globals = ast.findall('./variables/variable');
	const int8Ty = llvm.Type.getInt8Ty(context);
	const int64Ty = llvm.Type.getInt64Ty(context);
	const int8PtrTy = llvm.Type.getInt8PtrTy(context);
	const globalStructTy = llvm.StructType.get(context, [int8Ty, int64Ty, int8PtrTy]);
	for (const g of globals) {
		const gid = sanitizeVariableName(g['attrib']['id']);
		const gvar = new llvm.GlobalVariable(_module, globalStructTy, false, llvm.LinkageTypes.InternalLinkage, llvm.Constant.getNullValue(globalStructTy), gid);
		globalMap.set(gid, gvar);
	}
}

function compileBlock(context: llvm.LLVMContext, _module: llvm.Module) {

}

function main() {
	const ast = loadXMLFile(XML_INPUT_PATH);
	const context = new llvm.LLVMContext();
	const _module = new llvm.Module("blockyllvm", context);

	// Compile Globals Variable
	compileGlobals(context, _module, ast);

	// Genrate Main Function 
	const mainFnTy = llvm.FunctionType.get(llvm.Type.getVoidTy(context), false);
	// const mainFn = llvm.Function.create(mainFnTy, llvm.LinkageTypes.InternalLinkage, "main", _module);

	llvm.verifyModule(_module);
	const ll = _module.print();
	console.log(ll);
}

main()

