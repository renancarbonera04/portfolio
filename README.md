# Trabalhos Faculdade 🎓

Portfólio de projetos acadêmicos desenvolvidos durante a graduação, com foco em **Python**, **análise de dados**, **machine learning** e **otimização**.

---

## 📋 Projetos

### 1. Manutenção Preditiva com K-Nearest Neighbors (KNN)

**Descrição:** Modelo de classificação binária para prever falhas em equipamentos industriais utilizando dados históricos de sensores. O projeto aplica técnicas de machine learning para a detecção antecipada de falhas, permitindo implementar estratégias de manutenção preditiva em ambientes de Indústria 4.0.

**Objetivos:**
- Identificar padrões de falha em equipamentos através de análise de sensores
- Implementar um modelo KNN otimizado com hiperparâmetro K=7
- Atingir alta sensibilidade (Recall) na detecção de falhas

**Resultados alcançados:**
- **Recall:** 94,12% — detecta mais de 9 em cada 10 falhas reais
- **Precisão:** 92,75% — gera poucos alarmes desnecessários
- **ROC-AUC:** 0,9807 — excelente capacidade discriminativa

**Tecnologias:**
- Python 3.x
- Pandas, NumPy
- Scikit-learn (KNN, SMOTE, StandardScaler)
- Jupyter Notebook / Google Colab

**Arquivos:**
- `notebooks/manutencao_preditiva_KNN.ipynb` — Notebook com análise completa
- `relatorios/relatorio_knn.docx` — Relatório acadêmico detalhado
- `data/teste1000.csv` — Dataset utilizado (1.000 registros balanceados)

**Metodologia:**
1. **Pré-processamento:** Normalização com StandardScaler, codificação de variáveis categóricas
2. **Balanceamento:** SMOTE para lidar com desbalanceamento de classes (66% normal, 34% falha)
3. **Seleção de K:** Validação cruzada estratificada (5-fold) testando K de 1 a 29
4. **Avaliação:** Métricas de Precision, Recall e ROC-AUC (priorizando Recall para classe minoritária)

**Como usar:**

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/drive/1f_6aKYDwK1XE7DgAK7pJ6UWvkxB8bWco?usp=sharing)

Ou clonar e executar localmente:
```bash
pip install pandas scikit-learn numpy
jupyter notebook notebooks/manutencao_preditiva_KNN.ipynb
```

---

### 2. Otimização de Rotas Logísticas — Comida di Buteco

**Descrição:** Pipeline completo de otimização de rotas para o evento gastronômico Comida di Buteco em Campinas. Aplica Pesquisa Operacional para definir a sequência ótima de visitas a 56 estabelecimentos, considerando janelas de funcionamento, distâncias reais e tempo mínimo de permanência.

**Problema:** Vehicle Routing Problem com Janelas de Tempo (VRPTW)
- 56 estabelecimentos distribuídos em 4 dias (quarta, quinta, sexta e sábado)
- Cada bar possui horário de abertura e fechamento distinto
- Tempo mínimo de 30 minutos em cada parada

**Resultados alcançados:**
- Rotas com **intervalos regulares de 30-40 minutos** entre paradas
- Redução significativa de deslocamentos redundantes
- Melhor previsibilidade operacional
- Distribuição eficiente: Q4 (10), Q5 (10), V6 (14), S (22) estabelecimentos

**Tecnologias:**
- Python 3.x
- Pandas, NumPy
- Google OR-Tools (solver de otimização combinatória)
- OSRM (Open Source Routing Machine) — distâncias reais em malha viária
- Web Scraping (requests, BeautifulSoup)

**Arquivos:**
- `notebooks/roteirizacao_bares.ipynb` — Notebook completo do pipeline
- `apresentacoes/Artigo_Otimizacao_Rotas_Comida_di_Buteco.docx` — Artigo acadêmico
- `data/butecos_campinas.csv` — Base de dados dos estabelecimentos
- `data/roteiro_semanal.csv` — Roteiro otimizado com sequência e horários
- `data/matriz_distancias_bares.xlsx` — Matriz de distâncias (56x56)

**Pipeline de 4 etapas:**

1. **Web Scraping:** Coleta automatizada de nomes, endereços, coordenadas e horários dos bares
2. **Geocodificação:** Conversão de endereços para coordenadas (latitude, longitude)
3. **Matriz de Distâncias:** Cálculo via OSRM com distâncias reais sobre a malha viária de Campinas
4. **Otimização:** Google OR-Tools com heurística PATH_CHEAPEST_ARC + busca local guiada

**Modelo matemático:**
```
Minimizar: Distância total percorrida
Sujeito a:
  - Cada bar visitado exatamente uma vez
  - Visitas dentro da janela de funcionamento
  - Tempo mínimo de permanência (30 min) em cada parada
  - Retorno ao ponto de saída ao final do dia
```

**Exemplo de rota (sábado, primeiros 5 bares):**
| Ordem | Estabelecimento | Chegada |
|-------|-----------------|---------|
| 1     | Ponto de Saída  | —       |
| 2     | Bar A           | 07:00   |
| 3     | Bar B           | 07:33   |
| 4     | Bar C           | 08:08   |
| 5     | Bar D           | 08:40   |

**Como usar:**

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/drive/1N0xn93r24fIkmdlA8d-wfMPXW8PBl7Bb)

Ou localmente:
```bash
# Instalar dependências
pip install pandas numpy ortools requests beautifulsoup4

# Executar o pipeline
jupyter notebook notebooks/roteirizacao_bares.ipynb
```

---

## 🚀 Como usar os projetos

### Opção 1: Google Colab (sem instalação)
Basta clicar nos botões [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/drive/1f_6aKYDwK1XE7DgAK7pJ6UWvkxB8bWco?usp=sharing) acima.

### Opção 2: Clonar repositório
```bash
# Clonar
git clone https://github.com/renancarbonera04/Trabalhos-Faculdade.git
cd Trabalhos-Faculdade

# Criar ambiente virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate  # Windows

# Instalar dependências
pip install -r requirements.txt

# Executar notebooks
jupyter notebook
```

### Opção 3: Visual Studio Code
```bash
# Abrir a pasta no VSCode
code .

# Instalar extensão Jupyter
# Abrir qualquer .ipynb e executar as células
```

---

## 📁 Estrutura do repositório

```
Trabalhos-Faculdade/
├── notebooks/
│   ├── manutencao_preditiva_KNN.ipynb
│   └── roteirizacao_bares.ipynb
├── data/
│   ├── teste1000.csv                          # Dataset KNN
│   ├── butecos_campinas.csv                   # Base de bares
│   ├── roteiro_semanal.csv                    # Roteiro otimizado
│   └── matriz_distancias_bares.xlsx           # Matriz de distâncias
├── relatorios/
│   ├── relatorio_knn.docx                     # Relatório KNN
│   └── apresentacoes/
│       └── Artigo_Otimizacao_Rotas.docx
├── README.md
├── .gitignore
└── requirements.txt
```

---

## 🛠️ Tecnologias utilizadas

| Tecnologia | Uso |
|-----------|-----|
| **Python 3.x** | Linguagem principal |
| **Jupyter Notebook** | Ambiente interativo |
| **Pandas** | Manipulação de dados |
| **NumPy** | Computação numérica |
| **Scikit-learn** | Machine Learning (KNN, SMOTE) |
| **Google OR-Tools** | Otimização combinatória |
| **OSRM** | Roteamento em malha viária real |
| **BeautifulSoup** | Web scraping |
| **Matplotlib / Seaborn** | Visualização de dados |

---

## 📊 Comparação dos projetos

| Aspecto | KNN | Otimização de Rotas |
|--------|-----|-------------------|
| **Tipo** | Machine Learning | Pesquisa Operacional |
| **Problema** | Classificação binária | Otimização combinatória (VRPTW) |
| **Dataset** | 1.000 registros de sensores | 56 estabelecimentos georreferenciados |
| **Métrica principal** | Recall: 94,12% | Rotas com intervalos 30-40 min |
| **Aplicação** | Manutenção preditiva industrial | Logística e roteirização urbana |

---

## 📚 Referências e aprendizados

### Projeto KNN
- Chawla, N. V., et al. (2002). SMOTE: Synthetic Minority Over-sampling Technique
- Cover, T.; Hart, P. (1967). Nearest Neighbor Pattern Classification
- Saito, T.; Rehmsmeier, M. (2015). The Precision-Recall Plot is More Informative than the ROC Plot

### Projeto de Otimização de Rotas
- Dantzig, G. B.; Ramser, J. H. (1959). Vehicle Routing Problem (VRP)
- Solomon, M. (1987). Vehicle Routing Problem with Time Windows (VRPTW)
- Vidal, T.; Laporte, G.; Matl, P. (2020). Vehicle Routing: State-of-the-art and Recent Advances
- Google OR-Tools Documentation: https://developers.google.com/optimization

---

## ⭐ Destaques

✅ **Projetos práticos com dados reais**  
✅ **Documentação completa em relatórios acadêmicos**  
✅ **Código reprodutível e bem comentado**  
✅ **Aplicação de técnicas modernas de ML e PO**  
✅ **Integração de ferramentas profissionais (OR-Tools, OSRM)**  

---

## 👨‍💻 Autor

**Renan Carbonera** — Estudante de Engenharia de Produção  
PUC-Campinas

📧 Email: renancarbonera04@gmail.com  
🔗 GitHub: [@renancarbonera04](https://github.com/renancarbonera04)  
🔗 LinkedIn: [Renan Carbonera](https://www.linkedin.com/in/renan-carbonera/)

---

## 📝 Licença

Este repositório está sob licença aberta para fins educacionais e acadêmicos.

---

**Última atualização:** Agosto de 2026  
**Status:** ✅ Completo e documentado
