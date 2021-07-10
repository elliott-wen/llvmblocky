import {BlockyCompiler} from "../compiler";

test('TestGetGlobal', () => {
    const testXML = `<xml xmlns="https://developers.google.com/blockly/xml">
    <variables>
        <variable id="Tw=*Kg)BI{ABj)iq5?,4">x</variable>
        <variable id="9p5!v1Vy:e~_C;6;oRdk">num</variable>
    </variables>
    <block type="variables_get" id="4}qP\`gE%F/+EqbVf7P\`I">
         <field name="VAR" id="9p5!v1Vy:e~_C;6;oRdk">num</field>
    </block>
</xml>`;
    const compiler = new BlockyCompiler();
    const ll = compiler.compile(testXML);
    console.log(ll);
    expect(0).toBe(0);
});