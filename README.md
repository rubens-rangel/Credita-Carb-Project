# 🌱 Credit Carb - Sistema de Cálculo de Crédito de Carbono

Sistema web desenvolvido em Angular para cálculo de crédito de carbono baseado em viagens de participantes de eventos.

## 📋 Funcionalidades

### Página do Cliente (Formulário)
- ✅ Formulário completo para cálculo de crédito de carbono
- ✅ Captura de dados pessoais (nome, e-mail, CPF, telefone)
- ✅ Informações de origem e destino da viagem
- ✅ Seleção de meio de transporte (avião, carro, ônibus, trem, etc.)
- ✅ Campos específicos por tipo de transporte:
  - **Carro**: tipo de combustível, número de passageiros, consumo médio
  - **Avião**: classe do voo (econômica, executiva, primeira)
- ✅ Opção de viagem ida e volta
- ✅ Cálculo automático de emissão de CO₂
- ✅ Exibição de resultados:
  - Emissão de CO₂ em kg
  - Créditos de carbono (toneladas de CO₂ equivalente)
  - Equivalente em árvores plantadas
  - Equivalente em km de carro

### Página de Administrador
- ✅ Visualização de todos os cálculos realizados
- ✅ Estatísticas gerais:
  - Total de emissões de CO₂
  - Total de créditos de carbono
  - Total de árvores equivalentes
- ✅ Tabela resumida com todas as viagens
- ✅ Detalhes completos de cada viagem
- ✅ Exportação de dados em JSON
- ✅ Exclusão de registros individuais ou em massa

## 🚀 Como Executar

### Pré-requisitos
- Node.js (versão 18 ou superior)
- npm ou yarn

### Instalação

1. Instale as dependências:
```bash
npm install
```

2. Execute o servidor de desenvolvimento:
```bash
npm start
```

3. Acesse no navegador:
```
http://localhost:4200
```

## 📁 Estrutura do Projeto

```
src/
├── app/
│   ├── components/
│   │   ├── formulario/          # Componente do formulário de cliente
│   │   └── admin/               # Componente do painel de administrador
│   ├── services/
│   │   └── carbon-calculator.service.ts  # Serviço de cálculos
│   ├── app.component.ts         # Componente principal
│   └── app.routes.ts            # Configuração de rotas
├── styles.css                   # Estilos globais
└── index.html                   # HTML principal
```

## 🔢 Métodos de Cálculo

O sistema utiliza fatores de emissão padrão baseados em estudos científicos:

- **Avião**: 0.255 kg CO₂/km (econômica), 0.510 kg CO₂/km (executiva), 0.765 kg CO₂/km (primeira)
- **Carro Gasolina**: 0.192 kg CO₂/km
- **Carro Etanol**: 0.115 kg CO₂/km
- **Carro Diesel**: 0.171 kg CO₂/km
- **Carro Elétrico**: 0.053 kg CO₂/km
- **Carro Híbrido**: 0.120 kg CO₂/km
- **Ônibus**: 0.089 kg CO₂/km
- **Trem**: 0.041 kg CO₂/km
- **Metrô**: 0.027 kg CO₂/km
- **Motocicleta**: 0.113 kg CO₂/km
- **Navio**: 0.019 kg CO₂/km

### Conversões
- 1 crédito de carbono = 1 tonelada de CO₂ equivalente
- 1 árvore absorve aproximadamente 22 kg de CO₂ por ano
- Para carros, a emissão é dividida pelo número de passageiros

## 💾 Armazenamento de Dados

Os dados são armazenados localmente no navegador usando `localStorage`. Para produção, recomenda-se integrar com um backend para persistência adequada.

## 🎨 Tecnologias Utilizadas

- Angular 17 (Standalone Components)
- TypeScript
- Reactive Forms
- CSS3 (Gradientes e design moderno)
- LocalStorage API

## 📝 Notas

- A distância pode ser informada manualmente ou será estimada automaticamente
- Para viagens internacionais, a distância estimada é de 5000 km
- Para viagens entre estados diferentes, a distância estimada é de 800 km
- Para viagens dentro do mesmo estado, a distância estimada é de 300 km

## 🔮 Melhorias Futuras

- Integração com API de geocodificação para cálculo preciso de distâncias
- Gráficos e visualizações de dados
- Relatórios em PDF
- Autenticação de usuários
- Backend para persistência de dados
- API REST para integração com outros sistemas

## 📄 Licença

Este projeto é de código aberto e está disponível para uso livre.


