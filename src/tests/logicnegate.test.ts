import {BlockyCompiler} from "../compiler";

test('TestLogicNegateGlobal', () => {
    const testXML = `<xml xmlns="https://developers.google.com/blockly/xml">
    <variables>
        <variable id="Tw=*Kg)BI{ABj)iq5?,4">x</variable>
        <variable id="9p5!v1Vy:e~_C;6;oRdk">num</variable>
    </variables>
    <block type="logic_negate" id="=tB$jo0Z}:vRAf90xv_n" x="213" y="187">
        <value name="BOOL">
          <block type="variables_get" id="x-VPNhYK./^6ru[J0oMM">
            <field name="VAR" id="9p5!v1Vy:e~_C;6;oRdk">num</field>
          </block>
        </value>
    </block>
</xml>`;
    const compiler = new BlockyCompiler();
    const ll = compiler.compile(testXML);
    console.log(ll);
    expect(0).toBe(0);
});

test('TestLogicNegateBoolean', () => {
    const testXML = `<xml xmlns="https://developers.google.com/blockly/xml">
    <variables>
        <variable id="Tw=*Kg)BI{ABj)iq5?,4">x</variable>
        <variable id="9p5!v1Vy:e~_C;6;oRdk">num</variable>
    </variables>
    <block type="text_print" id="$yAyNjUnS^UjDeDs!aTL" x="288" y="162">
        <value name="TEXT">
            <block type="logic_negate" id="=tB$jo0Z}:vRAf90xv_n" x="213" y="187">
                <value name="BOOL">
                  <block type="variables_get" id="x-VPNhYK./^6ru[J0oMM">
                    <field name="VAR" id="9p5!v1Vy:e~_C;6;oRdk">num</field>
                  </block>
                </value>
            </block>
        </value>
    </block>
</xml>`;
    const compiler = new BlockyCompiler();
    const ll = compiler.compile(testXML);
    console.log(ll);
    expect(0).toBe(0);
});

