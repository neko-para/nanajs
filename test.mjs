import { Lexer } from './index.mjs';

const script = `
blk = {
    x := 1;
    y := 2;
};
<x; y> = blk;
x = blk.x;
y = blk.y;
`

for (const token of Lexer(script)) {
    console.log(token)
}