const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const pagesDir = path.join(rootDir, 'pages');
const cssDir = path.join(rootDir, 'css');
const jsDir = path.join(rootDir, 'js');

// Helper wrapper to process files
function processFiles(dir, matchExt, replacer) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const f of files) {
        const fullPath = path.join(dir, f);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            processFiles(fullPath, matchExt, replacer);
        } else if (fullPath.endsWith(matchExt)) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let newContent = replacer(content, f);
            if (content !== newContent) {
                fs.writeFileSync(fullPath, newContent, 'utf8');
                console.log('Updated: ' + fullPath);
            }
        }
    }
}

console.log("--- Updating index.html ---");
processFiles(rootDir, 'index.html', (c) => {
    let out = c;
    out = out.replace(/href="([a-zA-Z0-9_-]+\.html)"/g, 'href="pages/$1"');
    out = out.replace(/52 playing card\//g, 'assets/cards/');
    return out;
});

console.log("--- Updating /pages/ ---");
processFiles(pagesDir, '.html', (c, filename) => {
    let out = c;
    // CSS paths (css/style.css -> ../css/style.css)
    out = out.replace(/href="css\//g, 'href="../css/');
    // JS paths (js/script.js -> ../js/script.js)
    out = out.replace(/src="js\//g, 'src="../js/');
    // Assets paths
    out = out.replace(/52 playing card\//g, '../assets/cards/');
    out = out.replace(/Slots\//g, '../assets/slots/');
    out = out.replace(/Roulette\//g, '../assets/roulette/');
    // Link back to index
    out = out.replace(/href="index.html"/g, 'href="../index.html"');
    // For lobby links to other rooms, they are in the same folder now, so no ../ needed.
    // Replace href="[name].html" with href="[name].html" (no change) except index
    return out;
});

console.log("--- Updating JS files ---");
processFiles(jsDir, '.js', (c) => {
    let out = c;
    // Image paths inside JS strings (like `52 playing card/back.png` or `Slots/symbol.png`)
    // Because JS is loaded by pages in `pages/`, the relative path is from the HTML file!
    // So "52 playing card" -> "../assets/cards"
    out = out.replace(/52 playing card\//g, '../assets/cards/');
    out = out.replace(/Slots\//g, '../assets/slots/');
    out = out.replace(/Roulette\//g, '../assets/roulette/');
    
    // Also window.location.href = 'index.html' needs to be '../index.html' if called from pages/
    // We will do a safe replace for window.location and hrefs
    out = out.replace(/'index.html'/g, "'../index.html'");
    out = out.replace(/"index.html"/g, '"../index.html"');
    
    return out;
});

console.log("--- Updating CSS files ---");
processFiles(cssDir, '.css', (c) => {
    let out = c;
    // URL relative paths in CSS: "url('../assets/...')"
    // If it was "url('52 playing card/...')" from CSS, it used to be relative to CSS folder, which would look in css/52 playing card. That's wrong.
    // Let's just fix any instances of the strings if they exist.
    out = out.replace(/52 playing card\//g, '../assets/cards/');
    out = out.replace(/Slots\//g, '../assets/slots/');
    out = out.replace(/Roulette\//g, '../assets/roulette/');
    return out;
});

console.log("Done refactoring paths.");
