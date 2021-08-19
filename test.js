const nanaParser = require('./index.js')
const fs = require('fs')

const script = `
    blk = {
        x := 1;
        y := 2;
        max := |x, y| [
            x - y
        ];
        1
    };
    <x; y> = blk;
    blk.max blk.x blk.y
`

fs.writeFileSync('ast.json', JSON.stringify(nanaParser(script), null, 4))