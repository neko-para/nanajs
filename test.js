import { Lexer, Parser } from './index.js';
import { promises as fs } from 'fs'

const script = `
blk = {
    x := 1;
    y := 2;
    fun := |x, y| [
        x, x + 1, y, y + 1
    ];
    1
};
<x; y> = blk;
blk.fun 1 2
`

fs.writeFile('ast.json', JSON.stringify(Parser(Lexer(script)), null, 4)).then(() => {
    console.log('done')
})