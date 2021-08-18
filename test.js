import { Lexer, Parser } from './index.js';
import { promises as fs } from 'fs'

const script = `
blk = {
    x := 1;
    y := 2;
    fun := |x| [
        x, x + 1, x + 2
    ];
    1
};
<x; y> = blk;
blk.fun 1
`

fs.writeFile('ast.json', JSON.stringify(Parser(Lexer(script)), null, 4)).then(() => {
    console.log('done')
})