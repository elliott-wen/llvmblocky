import * as llvm from "llvm-node";

function testLLVM() {
	const context = new llvm.LLVMContext();
	const module = new llvm.Module("test", context);

	const intType = llvm.Type.getInt32Ty(context);
	const initializer = llvm.ConstantInt.get(context, 0);
	const globalVariable = new llvm.GlobalVariable(module, intType, true, llvm.LinkageTypes.InternalLinkage, initializer);

	const ll = module.print(); // prints IR
	console.log(ll);
}

testLLVM();