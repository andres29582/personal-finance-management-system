import { Injectable } from '@nestjs/common';
import type {
  PrevisaoDeficitResponseDto,
  RiscoDeficit,
} from './dto/previsao-deficit-response.dto';
import { DeficitFeaturesService } from './services/deficit-features.service';
import { MlPredictClientService } from './services/ml-predict-client.service';

@Injectable()
export class PrevisoesService {
  constructor(
    private readonly deficitFeaturesService: DeficitFeaturesService,
    private readonly mlPredictClientService: MlPredictClientService,
  ) {}

  async preverDeficit(
    usuarioId: string,
    mes?: string,
  ): Promise<PrevisaoDeficitResponseDto> {
    const { features, mesReferencia } = await this.deficitFeaturesService.build(
      usuarioId,
      mes,
    );
    const prediction = await this.mlPredictClientService.predict(features);
    const risco = this.resolveRisk(prediction.probability);
    const deficitPrevisto = prediction.prediction === 1;

    return {
      deficitPrevisto,
      features,
      mensagem: this.buildMessage(deficitPrevisto, risco),
      mesReferencia,
      prediction: prediction.prediction,
      probability: Number(prediction.probability.toFixed(4)),
      risco,
    };
  }

  private buildMessage(deficitPrevisto: boolean, risco: RiscoDeficit): string {
    if (!deficitPrevisto) {
      return 'O modelo nao indica deficit para o mes selecionado.';
    }

    if (risco === 'alto') {
      return 'Existe risco alto de deficit para o mes selecionado.';
    }

    if (risco === 'moderado') {
      return 'Existe risco moderado de deficit para o mes selecionado.';
    }

    return 'Existe baixo risco de deficit para o mes selecionado.';
  }

  private resolveRisk(probability: number): RiscoDeficit {
    if (probability >= 0.7) {
      return 'alto';
    }

    if (probability >= 0.4) {
      return 'moderado';
    }

    return 'baixo';
  }
}
