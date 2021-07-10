import * as et from "elementtree";
import fs from "fs";

import {BlockyCompiler} from "./compiler"


const XML_INPUT_PATH = "sample.xml";

function main() {
    const xmlString = fs.readFileSync(XML_INPUT_PATH, {encoding: 'utf-8'});
    const bl = new BlockyCompiler();
    bl.compile(xmlString);
}

main()