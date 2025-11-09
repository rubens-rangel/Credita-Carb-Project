import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CarbonCalculatorService, ViagemData, CalculoResultado, EventoConfig, TrechoViagem } from '../../services/carbon-calculator.service';
import { GeocodingService, Cidade, EnderecoCEP } from '../../services/geocoding.service';

@Component({
  selector: 'app-formulario',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './formulario.component.html',
  styleUrls: ['./formulario.component.css']
})
export class FormularioComponent implements OnInit {
  formulario!: FormGroup;
  resultado?: CalculoResultado;
  calculado = false;
  enviado = false;
  carregando = false;
  evento?: EventoConfig;
  cidadesPorTrecho: { [index: number]: Cidade[] } = {};
  mostrarAutocompletePorTrecho: { [index: number]: boolean } = {};
  trechos: TrechoViagem[] = [];
  enderecosCEP: { [index: number]: EnderecoCEP } = {};

  meiosTransporte = [
    { value: 'aviao', label: 'Avião' },
    { value: 'carro', label: 'Carro' },
    { value: 'onibus', label: 'Ônibus' },
    { value: 'trem', label: 'Trem' },
    { value: 'metro', label: 'Metrô' },
    { value: 'motocicleta', label: 'Motocicleta' },
    { value: 'navio', label: 'Navio/Barco' }
  ];

  tiposCombustivel = [
    { value: 'gasolina', label: 'Gasolina' },
    { value: 'etanol', label: 'Etanol' },
    { value: 'diesel', label: 'Diesel' },
    { value: 'eletrico', label: 'Elétrico' },
    { value: 'hibrido', label: 'Híbrido' }
  ];

  classesVoo = [
    { value: 'economica', label: 'Econômica' },
    { value: 'executiva', label: 'Executiva' },
    { value: 'primeira', label: 'Primeira Classe' }
  ];

  estadosBrasil = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  constructor(
    private fb: FormBuilder,
    private carbonService: CarbonCalculatorService,
    private geocodingService: GeocodingService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.inicializarFormulario();
    this.configurarAutocomplete();
    this.carregarEvento();
  }

  carregarEvento(): void {
    const evento = this.carbonService.obterEvento();
    this.evento = evento || undefined;
    if (this.evento && this.formulario) {
      // Preencher destino automaticamente com o evento (campos ocultos)
      setTimeout(() => {
        if (this.formulario) {
          this.formulario.patchValue({
            destinoCidade: this.evento!.cidade,
            destinoEstado: this.evento!.estado,
            destinoPais: this.evento!.pais
          });
        }
      }, 100);
    } else {
      // Se não houver evento configurado, alertar o usuário
      setTimeout(() => {
        if (!this.evento) {
          alert('Atenção: Nenhum evento configurado. Entre em contato com o administrador.');
        }
      }, 500);
    }
  }



  configurarAutocomplete(): void {
    // Autocomplete será configurado dinamicamente por trecho
  }

  configurarAutocompleteTrecho(index: number, estado: string): void {
    if (estado) {
      this.geocodingService.buscarCidadesPorEstado(estado).subscribe(cidades => {
        this.cidadesPorTrecho[index] = cidades;
      });
    }
  }

  buscarEnderecoPorCEPTrecho(index: number, cep: string): void {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length === 8) {
      this.geocodingService.buscarCEP(cepLimpo).subscribe(endereco => {
        if (endereco) {
          this.enderecosCEP[index] = endereco;
        }
      });
    }
  }

  aplicarMascaraCEP(cep: string): string {
    const cepLimpo = cep.replace(/\D/g, '');
    return cepLimpo.replace(/(\d{5})(\d)/, '$1-$2');
  }

  atualizarCepTrecho(index: number, cep: string): void {
    const cepFormatado = this.aplicarMascaraCEP(cep);
    this.atualizarTrecho(index, 'cepOrigem', cepFormatado);
    this.buscarEnderecoPorCEPTrecho(index, cepFormatado);
  }

  selecionarCidadeTrecho(index: number, cidade: Cidade): void {
    this.trechos[index] = {
      ...this.trechos[index],
      origemCidade: cidade.nome,
      origemEstado: cidade.estado
    };
    this.trechos = [...this.trechos];
    this.mostrarAutocompletePorTrecho[index] = false;
  }

  filtrarCidadesTrecho(index: number, valor: string): Cidade[] {
    const cidades = this.cidadesPorTrecho[index] || [];
    const valorLower = valor.toLowerCase();
    return cidades.filter(c => 
      c.nome.toLowerCase().includes(valorLower)
    ).slice(0, 10);
  }

  esconderAutocompleteTrecho(index: number): void {
    setTimeout(() => {
      this.mostrarAutocompletePorTrecho[index] = false;
    }, 200);
  }

  inicializarFormulario(): void {
    this.formulario = this.fb.group({
      // Dados pessoais
      nome: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      cpf: ['', [Validators.required]],
      telefone: ['', [Validators.required]],
      
      // Destino (preenchido automaticamente pelo evento)
      destinoCidade: [''],
      destinoEstado: [''],
      destinoPais: ['Brasil'],
      
      // Informações do evento
      diasNoEvento: ['', [Validators.required, Validators.min(1)]],
      idaEVolta: [false],
      
      // Observações
      observacoes: ['']
    });

    // Inicializar com um trecho vazio
    this.trechos = [this.criarTrechoVazio()];
  }

  criarTrechoVazio(): TrechoViagem {
    return {
      meioTransporte: '',
      distanciaKm: 0,
      tipoCombustivel: '',
      numeroPassageiros: 1,
      classeVoo: ''
    };
  }

  adicionarTrecho(): void {
    this.trechos.push(this.criarTrechoVazio());
  }

  removerTrecho(index: number): void {
    if (this.trechos.length > 1) {
      this.trechos.splice(index, 1);
    }
  }


  atualizarValidadoresTransporte(meioTransporte: string): void {
    const distanciaControl = this.formulario.get('distanciaKm');
    const tipoCombustivelControl = this.formulario.get('tipoCombustivel');
    const numeroPassageirosControl = this.formulario.get('numeroPassageiros');
    const classeVooControl = this.formulario.get('classeVoo');

    // Limpar validadores
    distanciaControl?.clearValidators();
    tipoCombustivelControl?.clearValidators();
    numeroPassageirosControl?.clearValidators();
    classeVooControl?.clearValidators();

    if (meioTransporte === 'carro') {
      tipoCombustivelControl?.setValidators([Validators.required]);
      numeroPassageirosControl?.setValidators([Validators.required, Validators.min(1)]);
    }

    if (meioTransporte === 'aviao') {
      classeVooControl?.setValidators([Validators.required]);
    }

    distanciaControl?.setValidators([Validators.min(0)]);
    
    distanciaControl?.updateValueAndValidity();
    tipoCombustivelControl?.updateValueAndValidity();
    numeroPassageirosControl?.updateValueAndValidity();
    classeVooControl?.updateValueAndValidity();
  }

  calcular(): void {
    // Validar se há evento configurado
    if (!this.evento) {
      alert('Nenhum evento configurado. Entre em contato com o administrador.');
      return;
    }

    // Validar se há pelo menos um trecho válido
    const trechosValidos = this.trechos.filter(t => t.meioTransporte);
    if (trechosValidos.length === 0) {
      alert('Adicione pelo menos um meio de transporte.');
      return;
    }

    // Validar campos obrigatórios
    const camposObrigatorios = ['nome', 'email', 'cpf', 'telefone', 'diasNoEvento'];
    const camposInvalidos = camposObrigatorios.filter(campo => {
      const control = this.formulario.get(campo);
      return !control || control.invalid;
    });

    if (camposInvalidos.length > 0) {
      this.marcarCamposInvalidos();
      return;
    }

    // Validar trechos
    for (let i = 0; i < trechosValidos.length; i++) {
      const trecho = trechosValidos[i];
      const transporte = trecho.meioTransporte;

      if (transporte === 'aviao' || transporte === 'trem') {
        if (!trecho.origemCidade || !trecho.origemEstado) {
          alert(`Trecho ${i + 1}: Informe a cidade e estado de origem.`);
          return;
        }
        // Preencher destino padrão se não informado
        if (!trecho.destinoCidade) {
          trecho.destinoCidade = this.evento.cidade;
          trecho.destinoEstado = this.evento.estado;
        }
      } else if (transporte === 'carro' || transporte === 'motocicleta' || transporte === 'onibus') {
        if (!trecho.cepOrigem) {
          alert(`Trecho ${i + 1}: Informe o CEP de origem.`);
          return;
        }
      }
    }

    // Garantir que destino está preenchido com o evento
    if (!this.formulario.get('destinoCidade')?.value) {
      this.formulario.patchValue({
        destinoCidade: this.evento.cidade,
        destinoEstado: this.evento.estado,
        destinoPais: this.evento.pais
      });
    }

    this.carregando = true;
    this.calculado = false;
    
    const dadosViagem: ViagemData = {
      ...this.formulario.value,
      trechos: trechosValidos
    };
    
    this.carbonService.calcularEmissao(dadosViagem).subscribe({
      next: (resultado) => {
        this.resultado = resultado;
        this.calculado = true;
        this.carregando = false;
      },
      error: (error) => {
        console.error('Erro ao calcular:', error);
        this.carregando = false;
        alert('Erro ao calcular emissão. Tente novamente.');
      }
    });
  }


  enviar(): void {
    if (this.formulario.valid && this.resultado) {
      const dadosViagem: ViagemData = this.formulario.value;
      this.carbonService.salvarViagem(dadosViagem, this.resultado);
      this.enviado = true;
      
      setTimeout(() => {
        this.resetarFormulario();
      }, 3000);
    }
  }

  resetarFormulario(): void {
    this.formulario.reset();
    this.resultado = undefined;
    this.calculado = false;
    this.enviado = false;
    this.trechos = [this.criarTrechoVazio()];
    this.enderecosCEP = {};
    this.cidadesPorTrecho = {};
    this.mostrarAutocompletePorTrecho = {};
    this.inicializarFormulario();
  }

  marcarCamposInvalidos(): void {
    Object.keys(this.formulario.controls).forEach(key => {
      const control = this.formulario.get(key);
      if (control && control.invalid) {
        control.markAsTouched();
      }
    });
  }

  get campoInvalido(): (campo: string) => boolean {
    return (campo: string) => {
      const control = this.formulario.get(campo);
      return !!(control && control.invalid && control.touched);
    };
  }

  mostrarCamposCarro(trecho: TrechoViagem): boolean {
    return trecho.meioTransporte === 'carro';
  }

  mostrarCamposAviao(trecho: TrechoViagem): boolean {
    return trecho.meioTransporte === 'aviao';
  }

  atualizarTrecho(index: number, campo: string, valor: any): void {
    // Tratar valores vazios
    if (valor === '' || valor === null) {
      valor = undefined;
    }
    
    const trechoAtualizado = { ...this.trechos[index], [campo]: valor };
    
    // Se mudou o meio de transporte, limpar campos específicos do outro meio e origem
    if (campo === 'meioTransporte') {
      // Limpar campos de origem anteriores
      trechoAtualizado.origemCidade = undefined;
      trechoAtualizado.origemEstado = undefined;
      trechoAtualizado.destinoCidade = undefined;
      trechoAtualizado.destinoEstado = undefined;
      trechoAtualizado.cepOrigem = undefined;
      
      if (valor === 'carro' || valor === 'motocicleta' || valor === 'onibus') {
        // Limpar campos de avião/trem
        trechoAtualizado.classeVoo = undefined;
      } else if (valor === 'aviao' || valor === 'trem') {
        // Limpar campos de carro/moto/ônibus
        trechoAtualizado.tipoCombustivel = undefined;
        trechoAtualizado.numeroPassageiros = undefined;
        trechoAtualizado.consumoMedio = undefined;
        trechoAtualizado.cepOrigem = undefined;
      } else {
        // Limpar todos os campos específicos se não for nenhum dos anteriores
        trechoAtualizado.tipoCombustivel = undefined;
        trechoAtualizado.numeroPassageiros = undefined;
        trechoAtualizado.consumoMedio = undefined;
        trechoAtualizado.classeVoo = undefined;
      }
    }
    
    // Criar nova referência do array para garantir detecção de mudanças
    this.trechos = [
      ...this.trechos.slice(0, index),
      trechoAtualizado,
      ...this.trechos.slice(index + 1)
    ];
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

  trackByTrechoIndex(index: number, trecho: TrechoViagem): number {
    return index;
  }

  toggleIdaEVolta(): void {
    const currentValue = this.formulario.get('idaEVolta')?.value;
    this.formulario.patchValue({ idaEVolta: !currentValue });
  }
}

