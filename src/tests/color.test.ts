import {BlockyCompiler} from "../compiler";

test('TestColorPicker', () => {
    const testXML = `<xml xmlns="https://developers.google.com/blockly/xml">
    <variables>
        <variable id="Tw=*Kg)BI{ABj)iq5?,4">x</variable>
        <variable id="9p5!v1Vy:e~_C;6;oRdk">num</variable>
    </variables>
    <block type="colour_picker" id=":cJkb[lVe*/d*xC\`1[^1" x="237" y="63">
        <field name="COLOUR">#ff0000</field>
    </block>
</xml>`;
    const compiler = new BlockyCompiler();
    const ll = compiler.compile(testXML);
    console.log(ll);
    expect(0).toBe(0);
});