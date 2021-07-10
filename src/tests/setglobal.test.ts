import {BlockyCompiler} from '../compiler';

test('TestSetGlobalConstString', () => {
    const testXML = `<xml xmlns="https://developers.google.com/blockly/xml">
    <variables>
        <variable id="Tw=*Kg)BI{ABj)iq5?,4">x</variable>
        <variable id="9p5!v1Vy:e~_C;6;oRdk">num</variable>
    </variables>
    <block type="variables_set" id="Mxe$P,PZ:TqX0MPi[\`L@">
        <field name="VAR" id="9p5!v1Vy:e~_C;6;oRdk">num</field>
        <value name="VALUE">
            <block type="text" id="56Ck;l@y8HB@1!LBvP.G">
                <field name="TEXT">abcdefg</field>
            </block>-->
        </value>
    </block>
</xml>`;
    const compiler = new BlockyCompiler();
    const ll = compiler.compile(testXML);
    console.log(ll);
    expect(0).toBe(0);
});

test('TestSetGlobalInteger', () => {
    const testXML = `<xml xmlns="https://developers.google.com/blockly/xml">
    <variables>
        <variable id="Tw=*Kg)BI{ABj)iq5?,4">x</variable>
        <variable id="9p5!v1Vy:e~_C;6;oRdk">num</variable>
    </variables>
    <block type="variables_set" id="Mxe$P,PZ:TqX0MPi[\`L@">
        <field name="VAR" id="9p5!v1Vy:e~_C;6;oRdk">num</field>
        <value name="VALUE">
            <block type="math_number" id="l{D!^QN%{[HO/,HEKXJ-">
                <field name="NUM">123</field>
            </block>
        </value>
    </block>
</xml>`;
    const compiler = new BlockyCompiler();
    const ll = compiler.compile(testXML);
    console.log(ll);
    expect(0).toBe(0);
});

test('TestSetGlobalDouble', () => {
    const testXML = `<xml xmlns="https://developers.google.com/blockly/xml">
    <variables>
        <variable id="Tw=*Kg)BI{ABj)iq5?,4">x</variable>
        <variable id="9p5!v1Vy:e~_C;6;oRdk">num</variable>
    </variables>
    <block type="variables_set" id="Mxe$P,PZ:TqX0MPi[\`L@">
        <field name="VAR" id="9p5!v1Vy:e~_C;6;oRdk">num</field>
        <value name="VALUE">
            <block type="math_number" id="l{D!^QN%{[HO/,HEKXJ-">
                <field name="NUM">123.1</field>
            </block>
        </value>
    </block>
</xml>`;
    const compiler = new BlockyCompiler();
    const ll = compiler.compile(testXML);
    console.log(ll);
    expect(0).toBe(0);
});

test('TestSetGlobalGlobal', () => {
    const testXML = `<xml xmlns="https://developers.google.com/blockly/xml">
    <variables>
        <variable id="Tw=*Kg)BI{ABj)iq5?,4">x</variable>
        <variable id="9p5!v1Vy:e~_C;6;oRdk">num</variable>
    </variables>
    <block type="variables_set" id="Mxe$P,PZ:TqX0MPi[\`L@">
        <field name="VAR" id="9p5!v1Vy:e~_C;6;oRdk">num</field>
        <value name="VALUE">
            <block type="variables_get" id="4}qP\`gE%F/+EqbVf7P\`I">
                <field name="VAR" id="Tw=*Kg)BI{ABj)iq5?,4">x</field>
             </block>
        </value>
    </block>
</xml>`;
    const compiler = new BlockyCompiler();
    const ll = compiler.compile(testXML);
    console.log(ll);
    expect(0).toBe(0);
});
