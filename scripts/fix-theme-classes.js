// scripts/fix-theme-classes.js
const fs = require('fs');
const path = require('path');

// Mapeamento de substituições - o que encontrar e por que substituir
const replacements = [
  // Cores de texto
  { from: /text-\[#8d8a86\]/g, to: 'text-theme-secondary' },
  { from: /text-\[#8d8a86\]\/80/g, to: 'text-theme-secondary/80' },
  { from: /text-\[#2d2a26\]/g, to: 'text-theme-primary' },
  { from: /text-\[#6d6a66\]/g, to: 'text-theme-secondary' },
  { from: /text-\[#5d5a56\]/g, to: 'text-theme-secondary' },
  { from: /text-\[#64615d\]/g, to: 'text-theme-secondary' },
  { from: /text-\[#3d5a45\]/g, to: 'text-primary' },
  { from: /text-\[\#3d5a45\]/g, to: 'text-primary' },
  
  // Cores de fundo
  { from: /bg-white/g, to: 'bg-theme-card' },
  { from: /bg-\[\#fcfaf7\]/g, to: 'bg-theme-secondary' },
  { from: /bg-\[\#fcfaf7\]\/50/g, to: 'bg-theme-secondary/50' },
  { from: /bg-\[\#fafafa\]/g, to: 'bg-theme-tertiary' },
  { from: /bg-\[\#f5f2ed\]/g, to: 'bg-theme-secondary' },
  { from: /bg-\[\#fcfaf7\]/g, to: 'bg-theme-secondary' },
  { from: /bg-neutral-50/g, to: 'bg-theme-tertiary' },
  { from: /bg-neutral-100/g, to: 'bg-theme-tertiary' },
  
  // Bordas
  { from: /border-\[\#e5e0d8\]/g, to: 'border-theme' },
  { from: /border-\[\#e5e0d8\]\/\d+/g, to: 'border-theme' },
  { from: /border-\[\#f0f0f0\]/g, to: 'border-theme' },
  { from: /border-\[\#f5f2ed\]/g, to: 'border-theme' },
  { from: /border-\[\#ece7e0\]/g, to: 'border-theme' },
  { from: /border-\[\#e5e0d8\]\/30/g, to: 'border-theme/30' },
  { from: /border-\[\#e5e0d8\]\/40/g, to: 'border-theme/40' },
  
  // Sombras
  { from: /shadow-sm/g, to: 'shadow-theme' },
  { from: /shadow-md/g, to: 'shadow-theme' },
  { from: /shadow-xs/g, to: 'shadow-theme' },
  
  // Outras classes de texto
  { from: /text-\[\#8d8a86\]/g, to: 'text-theme-secondary' },
  { from: /text-\[\#6d6a66\]/g, to: 'text-theme-secondary' },
  { from: /text-\[\#2d2a26\]/g, to: 'text-theme-primary' },
  
  // Classes de hover
  { from: /hover:bg-\[\#f5f2ed\]/g, to: 'hover:bg-theme-secondary' },
  { from: /hover:bg-\[\#fcfaf7\]/g, to: 'hover:bg-theme-secondary' },
  { from: /hover:border-\[\#3d5a45\]/g, to: 'hover:border-primary' },
  { from: /hover:border-\[\#3d5a45\]\/30/g, to: 'hover:border-primary/30' },
  { from: /hover:border-\[\#3d5a45\]\/40/g, to: 'hover:border-primary/40' },
  
  // Focus rings
  { from: /focus:ring-\[\#3d5a45\]\/20/g, to: 'focus:ring-primary/20' },
  { from: /focus:ring-\[\#3d5a45\]\/25/g, to: 'focus:ring-primary/25' },
  { from: /focus:ring-\[\#3d5a45\]\/10/g, to: 'focus:ring-primary/10' },
  
  // Classes de texto adicional
  { from: /text-\[\#8d8a86\]\s/g, to: 'text-theme-secondary ' },
  { from: /text-\[\#2d2a26\]\s/g, to: 'text-theme-primary ' },
];

// Processa um único arquivo
function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let originalContent = content;
  
  for (const { from, to } of replacements) {
    if (from.test(content)) {
      content = content.replace(from, to);
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    const changes = content !== originalContent;
    console.log(`✓ Corrigido: ${filePath}`);
    return true;
  }
  return false;
}

// Percorre diretórios recursivamente
function walkDirectory(dir, extensions = ['.tsx', '.jsx', '.ts', '.js']) {
  let filesProcessed = 0;
  let filesModified = 0;
  
  try {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        // Ignora node_modules, .git, dist, build
        if (!file.includes('node_modules') && 
            !file.includes('.git') && 
            !file.includes('dist') && 
            !file.includes('build') &&
            !file.includes('.next')) {
          const result = walkDirectory(filePath, extensions);
          filesProcessed += result.filesProcessed;
          filesModified += result.filesModified;
        }
      } else {
        const ext = path.extname(file);
        if (extensions.includes(ext)) {
          filesProcessed++;
          const wasModified = processFile(filePath);
          if (wasModified) filesModified++;
        }
      }
    }
  } catch (err) {
    console.error(`Erro ao ler diretório ${dir}:`, err.message);
  }
  
  return { filesProcessed, filesModified };
}

// Função principal
function main() {
  console.log('🔧 Aplicando classes de tema...');
  console.log('📁 Escaneando arquivos...\n');
  
  // Define os diretórios a serem escaneados
  const directories = [
    './src/components',
    './src/pages',
    './src/views',
    './src/layouts',
    './src/features',
    './src/app',
  ];
  
  let totalProcessed = 0;
  let totalModified = 0;
  
  for (const dir of directories) {
    if (fs.existsSync(dir)) {
      console.log(`📂 Processando: ${dir}`);
      const { filesProcessed, filesModified } = walkDirectory(dir);
      totalProcessed += filesProcessed;
      totalModified += filesModified;
      console.log(`   ✅ ${filesProcessed} arquivos lidos, ${filesModified} modificados\n`);
    }
  }
  
  console.log('━'.repeat(50));
  console.log(`📊 RESUMO:`);
  console.log(`   📄 Total de arquivos processados: ${totalProcessed}`);
  console.log(`   ✏️  Total de arquivos modificados: ${totalModified}`);
  console.log('━'.repeat(50));
  console.log('✅ Concluído!');
  console.log('\n💡 Dica: Rode novamente o script para garantir que todas as classes foram substituídas.');
  console.log('💡 Se precisar reverter, use "git checkout ."');
}

// Executa o script
main();