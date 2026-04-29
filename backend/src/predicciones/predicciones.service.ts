import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { Prediccion } from '../common/entities/prediccion.entity';

interface AIResponse {
  tipo: string;
  probabilidad: number;
  clase: number;
  modelo_version: string;
  fecha: string;
  parque_id?: string | null;
}

@Injectable()
export class PrediccionesService {
  private readonly log = new Logger('Predicciones');
  constructor(
    @InjectRepository(Prediccion) private readonly repo: Repository<Prediccion>,
    private readonly http: HttpService,
  ) {}

  latest() {
    return this.repo.createQueryBuilder('p')
      .distinctOn(['p.parque_id', 'p.tipo'])
      .orderBy('p.parque_id').addOrderBy('p.tipo').addOrderBy('p.fecha', 'DESC')
      .getMany();
  }

  async predictIncendio(body: Record<string, unknown>): Promise<AIResponse | null> {
    return this.callAndPersist('/predict/incendio', body);
  }

  async predictInundacion(body: Record<string, unknown>): Promise<AIResponse | null> {
    return this.callAndPersist('/predict/inundacion', body);
  }

  async heatmap(tipo: 'incendio' | 'inundacion') {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`/predictions/heatmap/${tipo}`),
      );
      return data;
    } catch (e) {
      this.log.warn(`Heatmap AI no disponible: ${(e as Error).message}`);
      return { type: 'FeatureCollection', features: [] };
    }
  }

  private async callAndPersist(path: string, body: Record<string, unknown>): Promise<AIResponse | null> {
    try {
      const { data } = await firstValueFrom(this.http.post<AIResponse>(path, body));
      if (data?.probabilidad != null && body.parque_id) {
        await this.repo.save({
          tipo: data.tipo as 'incendio' | 'inundacion',
          probabilidad: data.probabilidad,
          fecha: new Date(data.fecha),
          parque_id: body.parque_id as string,
          modelo_version: data.modelo_version,
          parametros: body,
        });
      }
      return data;
    } catch (e) {
      this.log.warn(`AI no disponible (${path}): ${(e as Error).message}`);
      return null;
    }
  }
}
