import { Module } from '@nestjs/common';
import {
  DEFAULT_RISK_RULES,
  RISK_RULES,
  RiskEngineService,
} from './risk-engine.service';

@Module({
  providers: [
    { provide: RISK_RULES, useValue: DEFAULT_RISK_RULES },
    RiskEngineService,
  ],
  exports: [RiskEngineService],
})
export class RiskModule {}
