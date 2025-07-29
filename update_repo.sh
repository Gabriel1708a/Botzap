#!/bin/bash

echo "🔄 Atualizando repositório..."

# Adicionar todos os arquivos
git add .

# Remover config.json local do staging
git reset dono/config.json

# Fazer commit
git commit -m "🔧 Atualizar porta padrão para 6000

✅ Mudanças realizadas:
- Porta padrão alterada de 3000/5000 → 6000  
- config.example.json atualizado
- panelHandler.js com porta padrão 6000
- API_DOCUMENTATION.md atualizada
- Melhorias na gestão de configurações

🚀 Benefícios:
- Evita conflitos com porta 5000
- Porta 6000 livre para uso
- Documentação consistente
- Sistema de config local preservado"

# Fazer push
git push origin main

echo "✅ Repositório atualizado com sucesso!"