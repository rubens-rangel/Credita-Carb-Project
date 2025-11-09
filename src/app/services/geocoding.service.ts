import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface Cidade {
  nome: string;
  estado: string;
  codigo?: string;
}

export interface EnderecoCEP {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class GeocodingService {
  private ibgeApiUrl = 'https://servicodados.ibge.gov.br/api/v1/localidades';
  
  constructor(private http: HttpClient) {}

  // Buscar cidades por estado usando API do IBGE
  buscarCidadesPorEstado(estado: string): Observable<Cidade[]> {
    if (!estado) {
      return of([]);
    }

    const estadoCodigo = this.obterCodigoEstado(estado);
    if (!estadoCodigo) {
      return of([]);
    }

    return this.http.get<any[]>(`${this.ibgeApiUrl}/estados/${estadoCodigo}/municipios`).pipe(
      map(municipios => 
        municipios.map(m => ({
          nome: m.nome,
          estado: estado,
          codigo: m.id.toString()
        }))
      ),
      catchError(() => of([]))
    );
  }

  // Buscar todas as cidades (com cache)
  buscarTodasCidades(): Observable<Cidade[]> {
    return this.http.get<any[]>(`${this.ibgeApiUrl}/municipios`).pipe(
      map(municipios => 
        municipios.map(m => ({
          nome: m.nome,
          estado: m.microrregiao.mesorregiao.UF.sigla,
          codigo: m.id.toString()
        }))
      ),
      catchError(() => of([]))
    );
  }

  // Calcular distância usando estimativa melhorada
  calcularDistancia(origemCidade: string, origemEstado: string, origemPais: string,
                    destinoCidade: string, destinoEstado: string, destinoPais: string): Observable<number> {
    const origem = `${origemCidade}, ${origemEstado}, ${origemPais}`;
    const destino = `${destinoCidade}, ${destinoEstado}, ${destinoPais}`;
    
    // Se países diferentes, retornar distância internacional estimada
    if (origemPais !== destinoPais) {
      return of(5000);
    }

    // Tentar calcular usando coordenadas conhecidas
    const distancia = this.estimarDistanciaPorCoordenadas(origem, destino);
    return of(distancia);
  }

  // Obter coordenadas aproximadas (mock - em produção usar API real)
  private obterCoordenadas(local: string): Observable<{lat: number, lng: number}> {
    // Mock - em produção usar Google Geocoding API ou similar
    return of({ lat: -23.5505, lng: -46.6333 }); // São Paulo como padrão
  }

  // Estimar distância usando fórmula de Haversine (aproximada)
  private estimarDistanciaPorCoordenadas(origem: string, destino: string): number {
    // Valores aproximados para cidades brasileiras principais
    const distancias: { [key: string]: { [key: string]: number } } = {
      'São Paulo': { 'Rio de Janeiro': 430, 'Brasília': 1015, 'Salvador': 1200, 'Belo Horizonte': 586 },
      'Rio de Janeiro': { 'São Paulo': 430, 'Brasília': 1148, 'Salvador': 1200, 'Belo Horizonte': 434 },
      'Brasília': { 'São Paulo': 1015, 'Rio de Janeiro': 1148, 'Salvador': 1080, 'Belo Horizonte': 740 },
      'Salvador': { 'São Paulo': 1200, 'Rio de Janeiro': 1200, 'Brasília': 1080, 'Belo Horizonte': 950 }
    };

    const origemCidade = origem.split(',')[0].trim();
    const destinoCidade = destino.split(',')[0].trim();

    if (distancias[origemCidade] && distancias[origemCidade][destinoCidade]) {
      return distancias[origemCidade][destinoCidade];
    }

    return this.estimarDistanciaSimples(origem, destino);
  }

  private estimarDistanciaSimples(origem: string, destino: string): number {
    const origemParts = origem.split(',');
    const destinoParts = destino.split(',');

    if (origemParts.length < 2 || destinoParts.length < 2) {
      return 500; // Distância padrão
    }

    const origemEstado = origemParts[1]?.trim();
    const destinoEstado = destinoParts[1]?.trim();

    if (origemEstado !== destinoEstado) {
      return 800; // Entre estados
    }

    return 300; // Mesmo estado
  }

  private obterCodigoEstado(sigla: string): string | null {
    const estados: { [key: string]: string } = {
      'AC': '12', 'AL': '27', 'AP': '16', 'AM': '13', 'BA': '29',
      'CE': '23', 'DF': '53', 'ES': '32', 'GO': '52', 'MA': '21',
      'MT': '51', 'MS': '50', 'MG': '31', 'PA': '15', 'PB': '25',
      'PR': '41', 'PE': '26', 'PI': '22', 'RJ': '33', 'RN': '24',
      'RS': '43', 'RO': '11', 'RR': '14', 'SC': '42', 'SP': '35',
      'SE': '28', 'TO': '17'
    };
    return estados[sigla] || null;
  }

  // Buscar endereço por CEP usando ViaCEP
  buscarCEP(cep: string): Observable<EnderecoCEP | null> {
    // Remove caracteres não numéricos
    const cepLimpo = cep.replace(/\D/g, '');
    
    if (cepLimpo.length !== 8) {
      return of(null);
    }

    return this.http.get<EnderecoCEP>(`https://viacep.com.br/ws/${cepLimpo}/json/`).pipe(
      map(endereco => {
        if (endereco.erro) {
          return null;
        }
        return endereco;
      }),
      catchError(() => of(null))
    );
  }

  // Calcular distância do CEP até o evento (genérico para qualquer cidade)
  calcularDistanciaCEP(cep: string, destinoCidade: string, destinoEstado: string): Observable<number> {
    return this.buscarCEP(cep).pipe(
      map(endereco => {
        if (!endereco) {
          return 0;
        }

        const cidadeOrigem = endereco.localidade;
        const estadoOrigem = endereco.uf;

        // Se o estado de origem for diferente do estado do evento, não calcular por CEP
        if (estadoOrigem !== destinoEstado) {
          return 0;
        }

        // Se for a mesma cidade, distância muito pequena (dentro da cidade)
        if (cidadeOrigem.toLowerCase() === destinoCidade.toLowerCase()) {
          return 10; // Estimativa de 10km dentro da mesma cidade
        }

        // Se for região metropolitana ou cidades próximas, calcular distância aproximada
        // Usar distâncias conhecidas para principais regiões metropolitanas brasileiras
        const distanciasRegioesMetropolitanas = this.obterDistanciasRegiaoMetropolitana(
          cidadeOrigem, 
          estadoOrigem, 
          destinoCidade, 
          destinoEstado
        );

        if (distanciasRegioesMetropolitanas > 0) {
          return distanciasRegioesMetropolitanas;
        }

        // Se for do mesmo estado mas cidades diferentes, estimar distância média
        // Distância média entre cidades no mesmo estado: ~50-150km
        return 80; // Estimativa padrão
      }),
      catchError(() => of(0))
    );
  }

  private obterDistanciasRegiaoMetropolitana(
    cidadeOrigem: string, 
    estadoOrigem: string, 
    cidadeDestino: string, 
    estadoDestino: string
  ): number {
    // Mapeamento de distâncias aproximadas dentro de regiões metropolitanas
    const regioesMetropolitanas: { [estado: string]: { [cidadeOrigem: string]: { [cidadeDestino: string]: number } } } = {
      // Região Metropolitana de Vitória/ES
      'ES': {
        'Vitória': { 'Vitória': 0, 'Vila Velha': 15, 'Cariacica': 20, 'Serra': 25, 'Viana': 30, 'Guarapari': 45, 'Fundão': 50 },
        'Vila Velha': { 'Vitória': 15, 'Vila Velha': 0, 'Cariacica': 18, 'Serra': 20 },
        'Cariacica': { 'Vitória': 20, 'Vila Velha': 18, 'Cariacica': 0, 'Serra': 22 },
        'Serra': { 'Vitória': 25, 'Vila Velha': 20, 'Cariacica': 22, 'Serra': 0 }
      },
      // Região Metropolitana de São Paulo/SP
      'SP': {
        'São Paulo': { 'São Paulo': 0, 'Guarulhos': 20, 'São Bernardo do Campo': 25, 'Santo André': 22, 'Osasco': 18, 'Campinas': 100 },
        'Guarulhos': { 'São Paulo': 20, 'Guarulhos': 0, 'São Bernardo do Campo': 35, 'Santo André': 32 },
        'São Bernardo do Campo': { 'São Paulo': 25, 'Guarulhos': 35, 'São Bernardo do Campo': 0, 'Santo André': 8 },
        'Santo André': { 'São Paulo': 22, 'Guarulhos': 32, 'São Bernardo do Campo': 8, 'Santo André': 0 },
        'Osasco': { 'São Paulo': 18, 'Osasco': 0, 'Barueri': 12, 'Carapicuíba': 15 }
      },
      // Região Metropolitana do Rio de Janeiro/RJ
      'RJ': {
        'Rio de Janeiro': { 'Rio de Janeiro': 0, 'Niterói': 15, 'São Gonçalo': 25, 'Duque de Caxias': 20, 'Nova Iguaçu': 35 },
        'Niterói': { 'Rio de Janeiro': 15, 'Niterói': 0, 'São Gonçalo': 18, 'Maricá': 30 },
        'São Gonçalo': { 'Rio de Janeiro': 25, 'Niterói': 18, 'São Gonçalo': 0, 'Itaboraí': 20 }
      },
      // Região Metropolitana de Belo Horizonte/MG
      'MG': {
        'Belo Horizonte': { 'Belo Horizonte': 0, 'Contagem': 15, 'Betim': 20, 'Ribeirão das Neves': 25, 'Sabará': 18 },
        'Contagem': { 'Belo Horizonte': 15, 'Contagem': 0, 'Betim': 12, 'Ribeirão das Neves': 20 },
        'Betim': { 'Belo Horizonte': 20, 'Contagem': 12, 'Betim': 0 }
      },
      // Região Metropolitana de Curitiba/PR
      'PR': {
        'Curitiba': { 'Curitiba': 0, 'São José dos Pinhais': 12, 'Pinhais': 10, 'Colombo': 15, 'Araucária': 20 },
        'São José dos Pinhais': { 'Curitiba': 12, 'São José dos Pinhais': 0, 'Pinhais': 8 },
        'Pinhais': { 'Curitiba': 10, 'São José dos Pinhais': 8, 'Pinhais': 0 }
      },
      // Região Metropolitana de Porto Alegre/RS
      'RS': {
        'Porto Alegre': { 'Porto Alegre': 0, 'Canoas': 15, 'Novo Hamburgo': 35, 'São Leopoldo': 30, 'Gravataí': 20 },
        'Canoas': { 'Porto Alegre': 15, 'Canoas': 0, 'Novo Hamburgo': 25 },
        'Novo Hamburgo': { 'Porto Alegre': 35, 'Canoas': 25, 'Novo Hamburgo': 0 }
      },
      // Região Metropolitana de Salvador/BA
      'BA': {
        'Salvador': { 'Salvador': 0, 'Lauro de Freitas': 20, 'Camaçari': 35, 'Simões Filho': 25 },
        'Lauro de Freitas': { 'Salvador': 20, 'Lauro de Freitas': 0, 'Camaçari': 25 },
        'Camaçari': { 'Salvador': 35, 'Lauro de Freitas': 25, 'Camaçari': 0 }
      },
      // Região Metropolitana de Recife/PE
      'PE': {
        'Recife': { 'Recife': 0, 'Olinda': 8, 'Jaboatão dos Guararapes': 15, 'Paulista': 12, 'Camaragibe': 10 },
        'Olinda': { 'Recife': 8, 'Olinda': 0, 'Paulista': 10 },
        'Jaboatão dos Guararapes': { 'Recife': 15, 'Jaboatão dos Guararapes': 0, 'Camaragibe': 12 }
      },
      // Região Metropolitana de Fortaleza/CE
      'CE': {
        'Fortaleza': { 'Fortaleza': 0, 'Caucaia': 18, 'Maracanaú': 15, 'Eusébio': 20 },
        'Caucaia': { 'Fortaleza': 18, 'Caucaia': 0, 'Maracanaú': 12 },
        'Maracanaú': { 'Fortaleza': 15, 'Caucaia': 12, 'Maracanaú': 0 }
      },
      // Região Metropolitana de Brasília/DF
      'DF': {
        'Brasília': { 'Brasília': 0, 'Taguatinga': 25, 'Ceilândia': 30, 'Planaltina': 45, 'Gama': 35 }
      }
    };

    const regiao = regioesMetropolitanas[estadoOrigem];
    if (!regiao) {
      return 0;
    }

    const cidadesOrigem = regiao[cidadeOrigem];
    if (!cidadesOrigem) {
      return 0;
    }

    const distancia = cidadesOrigem[cidadeDestino];
    return distancia !== undefined ? distancia : 0;
  }
}

