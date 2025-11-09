import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CarbonCalculatorService, EventoConfig } from '../../services/carbon-calculator.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit {
  viagens: any[] = [];
  totalEmissao = 0;
  totalCreditos = 0;
  totalArvores = 0;
  eventoForm!: FormGroup;
  eventoAtual?: EventoConfig;
  estadosBrasil = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  constructor(
    private carbonService: CarbonCalculatorService,
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.inicializarFormularioEvento();
    this.configurarMascaraCEP();
    this.carregarEvento();
    this.carregarViagens();
  }

  configurarMascaraCEP(): void {
    this.eventoForm.get('cep')?.valueChanges.subscribe(cep => {
      if (cep) {
        // Aplicar máscara de CEP
        const cepLimpo = cep.replace(/\D/g, '');
        const cepFormatado = cepLimpo.replace(/(\d{5})(\d)/, '$1-$2');
        if (cepFormatado !== cep) {
          this.eventoForm.patchValue({ cep: cepFormatado }, { emitEvent: false });
        }
      }
    });
  }

  inicializarFormularioEvento(): void {
    this.eventoForm = this.fb.group({
      nomeEvento: [''],
      cidade: ['', Validators.required],
      estado: ['', Validators.required],
      pais: ['Brasil', Validators.required],
      cep: ['', Validators.required],
      dataInicio: [''],
      dataFim: ['']
    });
  }

  carregarEvento(): void {
    const evento = this.carbonService.obterEvento();
    this.eventoAtual = evento || undefined;
    if (this.eventoAtual) {
      this.eventoForm.patchValue(this.eventoAtual);
    }
  }

  salvarEvento(): void {
    if (this.eventoForm.valid) {
      const evento: EventoConfig = this.eventoForm.value;
      this.carbonService.salvarEvento(evento);
      this.eventoAtual = evento;
      alert('Evento configurado com sucesso!');
    } else {
      alert('Preencha pelo menos cidade, estado, país e CEP.');
    }
  }

  removerEvento(): void {
    if (confirm('Tem certeza que deseja remover a configuração do evento?')) {
      this.carbonService.removerEvento();
      this.eventoAtual = undefined;
      this.eventoForm.reset();
      this.eventoForm.patchValue({ pais: 'Brasil' });
    }
  }

  carregarViagens(): void {
    this.viagens = this.carbonService.obterViagens();
    this.calcularTotais();
  }

  calcularTotais(): void {
    this.totalEmissao = this.viagens.reduce((sum, v) => sum + (v.resultado?.emissaoCO2 || 0), 0);
    this.totalCreditos = this.viagens.reduce((sum, v) => sum + (v.resultado?.creditosCarbono || 0), 0);
    this.totalArvores = this.viagens.reduce((sum, v) => sum + (v.resultado?.equivalenteArvores || 0), 0);
  }

  excluirViagem(index: number): void {
    if (confirm('Tem certeza que deseja excluir esta viagem?')) {
      this.carbonService.excluirViagem(index);
      this.carregarViagens();
    }
  }

  exportarDados(): void {
    const dados = {
      viagens: this.viagens,
      totais: {
        totalEmissao: this.totalEmissao,
        totalCreditos: this.totalCreditos,
        totalArvores: this.totalArvores
      },
      dataExportacao: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dados_carbono_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  exportarParaExcel(): void {
    // Criar cabeçalhos CSV
    const headers = [
      'Nome',
      'Email',
      'CPF',
      'Telefone',
      'Trechos (Origem → Destino)',
      'Destino (Cidade)',
      'Destino (Estado)',
      'Destino (País)',
      'Data Viagem',
      'Data Retorno',
      'Ida e Volta',
      'Distância Total (km)',
      'Emissão CO₂ (kg)',
      'Créditos de Carbono (tCO₂)',
      'Árvores Equivalentes',
      'Observações'
    ];

    // Criar linhas de dados
    const linhas = this.viagens.map(viagem => {
      const trechosInfo = viagem.trechos?.map((t: any, i: number) => {
        let origem = '';
        if (t.origemCidade) {
          origem = `${t.origemCidade}, ${t.origemEstado}`;
        } else if (t.cepOrigem) {
          origem = `CEP: ${t.cepOrigem}`;
        }
        const destino = t.destinoCidade ? `${t.destinoCidade}, ${t.destinoEstado}` : `${viagem.destinoCidade}, ${viagem.destinoEstado}`;
        return `Trecho ${i + 1}: ${this.formatarMeioTransporte(t.meioTransporte)} (${origem} → ${destino})`;
      }).join('; ') || 'N/A';

      return [
        viagem.nome || '',
        viagem.email || '',
        viagem.cpf || '',
        viagem.telefone || '',
        trechosInfo,
        viagem.destinoCidade || '',
        viagem.destinoEstado || '',
        viagem.destinoPais || '',
        viagem.dataViagem ? new Date(viagem.dataViagem).toLocaleDateString('pt-BR') : '',
        viagem.dataRetorno ? new Date(viagem.dataRetorno).toLocaleDateString('pt-BR') : '',
        viagem.idaEVolta ? 'Sim' : 'Não',
        viagem.resultado?.distanciaTotal || viagem.resultado?.distanciaCalculada || 0,
        viagem.resultado?.emissaoCO2 || 0,
        viagem.resultado?.creditosCarbono || 0,
        viagem.resultado?.equivalenteArvores || 0,
        viagem.observacoes || ''
      ];
    });

    // Adicionar linha de totais (11 campos antes de TOTAIS: nome, email, cpf, telefone, trechos, destino cidade, estado, pais, data viagem, retorno, ida/volta)
    linhas.push([
      '', '', '', '', '', '', '', '', '', '', '',
      'TOTAIS',
      this.totalEmissao.toFixed(2),
      this.totalCreditos.toFixed(3),
      this.totalArvores.toString(),
      ''
    ]);

    // Converter para CSV
    const csvContent = [
      headers.join(','),
      ...linhas.map(linha => linha.map(campo => {
        // Escapar campos que contêm vírgulas ou aspas
        const campoStr = String(campo || '');
        if (campoStr.includes(',') || campoStr.includes('"') || campoStr.includes('\n')) {
          return `"${campoStr.replace(/"/g, '""')}"`;
        }
        return campoStr;
      }).join(','))
    ].join('\n');

    // Adicionar BOM para Excel reconhecer UTF-8
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dados_carbono_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  limparTodos(): void {
    if (confirm('Tem certeza que deseja excluir TODAS as viagens? Esta ação não pode ser desfeita.')) {
      localStorage.removeItem('viagens_carbono');
      this.carregarViagens();
    }
  }

  formatarData(data: string): string {
    if (!data) return '-';
    return new Date(data).toLocaleDateString('pt-BR');
  }

  formatarMeioTransporte(meio: string): string {
    const meios: { [key: string]: string } = {
      'aviao': 'Avião',
      'carro': 'Carro',
      'onibus': 'Ônibus',
      'trem': 'Trem',
      'metro': 'Metrô',
      'motocicleta': 'Motocicleta',
      'navio': 'Navio/Barco'
    };
    return meios[meio] || meio;
  }

  logout(): void {
    if (confirm('Deseja realmente sair?')) {
      this.authService.logout();
    }
  }
}

