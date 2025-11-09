import { Injectable } from '@angular/core';
import { GeocodingService } from './geocoding.service';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface TrechoViagem {
  meioTransporte: string;
  distanciaKm?: number;
  // Para avião e trem: cidade de origem e destino
  origemCidade?: string;
  origemEstado?: string;
  destinoCidade?: string;
  destinoEstado?: string;
  // Para carro, moto, ônibus: CEP de origem
  cepOrigem?: string;
  tipoCombustivel?: string;
  numeroPassageiros?: number;
  classeVoo?: string;
  consumoMedio?: number;
}

export interface ViagemData {
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  destinoCidade: string;
  destinoEstado: string;
  destinoPais: string;
  trechos: TrechoViagem[];
  dataViagem: string;
  dataRetorno?: string;
  idaEVolta: boolean;
  observacoes?: string;
}

export interface CalculoResultado {
  emissaoCO2: number;
  creditosCarbono: number;
  equivalenteArvores: number;
  equivalenteKmCarro: number;
  distanciaTotal: number;
  trechos: Array<{
    trecho: TrechoViagem;
    distancia: number;
    emissao: number;
  }>;
}

export interface EventoConfig {
  cidade: string;
  estado: string;
  pais: string;
  cep?: string;
  nomeEvento?: string;
  dataInicio?: string;
  dataFim?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CarbonCalculatorService {
  constructor(private geocodingService: GeocodingService) {}
  
  // Fatores de emissão (kg CO2 por passageiro por km)
  private fatoresEmissao: { [key: string]: number } = {
    'aviao-economica': 0.255,
    'aviao-executiva': 0.510,
    'aviao-primeira': 0.765,
    'carro-gasolina': 0.192,
    'carro-etanol': 0.115,
    'carro-diesel': 0.171,
    'carro-eletrico': 0.053,
    'carro-hibrido': 0.120,
    'onibus': 0.089,
    'trem': 0.041,
    'metro': 0.027,
    'motocicleta': 0.113,
    'navio': 0.019
  };

  calcularEmissao(viagem: ViagemData): Observable<CalculoResultado> {
    // Calcular distâncias para cada trecho
    const calculosTrechos = viagem.trechos.map((trecho, index) => {
      return this.calcularDistanciaTrecho(trecho, viagem, index).pipe(
        map(distancia => ({
          trecho,
          distancia,
          emissao: this.calcularEmissaoTrecho(trecho, distancia)
        }))
      );
    });

    // Combinar todos os cálculos usando forkJoin
    if (calculosTrechos.length === 0) {
      return of(this.processarCalculoMultiploTrechos(viagem, []));
    }

    return forkJoin(calculosTrechos).pipe(
      map(resultados => {
        return this.processarCalculoMultiploTrechos(viagem, resultados);
      }),
      catchError(() => {
        // Em caso de erro, retornar cálculo vazio
        return of(this.processarCalculoMultiploTrechos(viagem, []));
      })
    );
  }

  private calcularDistanciaTrecho(trecho: TrechoViagem, viagem: ViagemData, index: number): Observable<number> {
    // Se já tiver distância informada, usar ela
    if (trecho.distanciaKm && trecho.distanciaKm > 0) {
      return of(trecho.distanciaKm);
    }

    const transporte = trecho.meioTransporte;
    
    // Para carro, moto, ônibus: usar CEP de origem
    if (transporte === 'carro' || transporte === 'motocicleta' || transporte === 'onibus') {
      if (trecho.cepOrigem) {
        return this.geocodingService.calcularDistanciaCEP(
          trecho.cepOrigem.replace(/\D/g, ''),
          viagem.destinoCidade,
          viagem.destinoEstado
        );
      }
      // Se não tiver CEP, retornar 0 para cálculo manual
      return of(0);
    }

    // Para avião e trem: usar cidade de origem e destino
    if (transporte === 'aviao' || transporte === 'trem') {
      const origemCidade = trecho.origemCidade;
      const origemEstado = trecho.origemEstado;
      const destinoCidade = trecho.destinoCidade || viagem.destinoCidade;
      const destinoEstado = trecho.destinoEstado || viagem.destinoEstado;

      if (!origemCidade || !origemEstado) {
        return of(0);
      }

      return this.geocodingService.calcularDistancia(
        origemCidade, origemEstado, 'Brasil',
        destinoCidade, destinoEstado, viagem.destinoPais
      );
    }

    // Para outros meios, usar cálculo genérico
    return of(0);
  }

  private calcularEmissaoTrecho(trecho: TrechoViagem, distancia: number): number {
    const fatorEmissao = this.obterFatorEmissaoTrecho(trecho);
    
    if (trecho.meioTransporte === 'carro' && trecho.numeroPassageiros && trecho.numeroPassageiros > 0) {
      return (fatorEmissao * distancia) / trecho.numeroPassageiros;
    }
    
    return fatorEmissao * distancia;
  }

  private obterFatorEmissaoTrecho(trecho: TrechoViagem): number {
    const transporte = trecho.meioTransporte;
    
    if (transporte === 'aviao') {
      const classe = trecho.classeVoo || 'economica';
      return this.fatoresEmissao[`aviao-${classe}`] || this.fatoresEmissao['aviao-economica'];
    }
    
    if (transporte === 'carro') {
      const combustivel = trecho.tipoCombustivel || 'gasolina';
      return this.fatoresEmissao[`carro-${combustivel}`] || this.fatoresEmissao['carro-gasolina'];
    }
    
    return this.fatoresEmissao[transporte] || 0.1;
  }

  private processarCalculoMultiploTrechos(
    viagem: ViagemData,
    resultadosTrechos: Array<{ trecho: TrechoViagem; distancia: number; emissao: number }>
  ): CalculoResultado {
    let emissaoCO2Total = 0;
    let distanciaTotal = 0;

    resultadosTrechos.forEach(resultado => {
      emissaoCO2Total += resultado.emissao;
      distanciaTotal += resultado.distancia;
    });

    // Se for ida e volta, dobrar a emissão
    if (viagem.idaEVolta) {
      emissaoCO2Total *= 2;
      distanciaTotal *= 2;
    }

    // Calcular créditos de carbono (1 crédito = 1 tonelada de CO2)
    const creditosCarbono = emissaoCO2Total / 1000;

    // Equivalente em árvores (1 árvore absorve ~22 kg CO2 por ano)
    const equivalenteArvores = Math.ceil(emissaoCO2Total / 22);

    // Equivalente em km de carro (média de 0.192 kg CO2/km)
    const equivalenteKmCarro = Math.round(emissaoCO2Total / 0.192);

    return {
      emissaoCO2: Math.round(emissaoCO2Total * 100) / 100,
      creditosCarbono: Math.round(creditosCarbono * 1000) / 1000,
      equivalenteArvores,
      equivalenteKmCarro,
      distanciaTotal: Math.round(distanciaTotal),
      trechos: resultadosTrechos.map(r => ({
        trecho: r.trecho,
        distancia: Math.round(r.distancia),
        emissao: Math.round(r.emissao * 100) / 100
      }))
    };
  }


  salvarViagem(viagem: ViagemData, resultado: CalculoResultado): void {
    const dados = {
      ...viagem,
      resultado,
      dataCalculo: new Date().toISOString()
    };
    
    const viagens = this.obterViagens();
    viagens.push(dados);
    localStorage.setItem('viagens_carbono', JSON.stringify(viagens));
  }

  obterViagens(): any[] {
    const dados = localStorage.getItem('viagens_carbono');
    return dados ? JSON.parse(dados) : [];
  }

  excluirViagem(index: number): void {
    const viagens = this.obterViagens();
    viagens.splice(index, 1);
    localStorage.setItem('viagens_carbono', JSON.stringify(viagens));
  }

  // Gerenciamento de Evento
  salvarEvento(evento: EventoConfig): void {
    localStorage.setItem('evento_config', JSON.stringify(evento));
  }

  obterEvento(): EventoConfig | null {
    const dados = localStorage.getItem('evento_config');
    return dados ? JSON.parse(dados) : null;
  }

  removerEvento(): void {
    localStorage.removeItem('evento_config');
  }
}

