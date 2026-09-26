import { Controller, Get } from '@nestjs/common';

export type HealthStatus = {
  readonly status: 'ok';
};

@Controller('health')
export class HealthController {
  @Get()
  public getHealth(): HealthStatus {
    return { status: 'ok' };
  }
}
