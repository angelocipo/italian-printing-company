import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Vercel Web Analytics snippet for static HTML
const analyticsSnippet = `
  <script>
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  </script>
  <script defer src="/_vercel/insights/script.js"></script>`;

function injectAnalytics(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if analytics is already injected
    if (content.includes('/_vercel/insights/script.js')) {
      console.log(`✓ Analytics already present in ${path.basename(filePath)}`);
      return false;
    }
    
    // Inject before </head>
    if (content.includes('</head>')) {
      content = content.replace('</head>', `${analyticsSnippet}\n</head>`);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Injected analytics into ${path.basename(filePath)}`);
      return true;
    } else {
      console.log(`⚠ No </head> tag found in ${path.basename(filePath)}`);
      return false;
    }
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let modified = 0;
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip .git and other hidden directories
      if (!entry.name.startsWith('.')) {
        modified += processDirectory(fullPath);
      }
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      if (injectAnalytics(fullPath)) {
        modified++;
      }
    }
  }
  
  return modified;
}

console.log('🚀 Injecting Vercel Web Analytics into HTML files...\n');
const modified = processDirectory(__dirname);
console.log(`\n✨ Done! Modified ${modified} file(s).`);
