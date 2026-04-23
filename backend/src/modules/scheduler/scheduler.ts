import cron from 'node-cron';
import { prisma } from '../../lib/prisma.js';
import { executionsService } from '../executions/executions.service.js';
import type { FlowBlockInput } from '../flows/flows.schemas.js';
import type { EngineLogger } from '../../lib/logger.js';

const INTERVAL_MAP: Record<string, string> = {
  every_minute: '* * * * *',
  every_hour: '0 * * * *',
  every_day: '0 8 * * *',
  every_week: '0 8 * * 1',
};

const scheduledFlows = new Map<string, { task: cron.ScheduledTask; interval: string }>();
let running = false;

export function startScheduler(logger: EngineLogger) {
  if (running) return;
  running = true;
  logger.info('Scheduler started');
  void tick(logger);
  cron.schedule('* * * * *', () => void tick(logger));
}

async function tick(logger: EngineLogger) {
  try {
    const flows = await prisma.flow.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, blocks: true, connections: true, userId: true },
    });

    const activeIds = new Set<string>();

    for (const flow of flows) {
      const blocks = (flow.blocks as FlowBlockInput[]) ?? [];
      const scheduleBlock = blocks.find((b) => b.definitionId === 'schedule-trigger');
      if (!scheduleBlock) continue;

      const intervalKey = String(scheduleBlock.properties.find((p) => p.key === 'interval')?.value ?? 'every_hour');
      const cronExpr = INTERVAL_MAP[intervalKey];
      if (!cronExpr) continue;

      activeIds.add(flow.id);
      const existing = scheduledFlows.get(flow.id);
      if (existing && existing.interval === cronExpr) continue;

      existing?.task.stop();

      const task = cron.schedule(cronExpr, async () => {
        try {
          logger.info({ flowId: flow.id }, 'Running scheduled flow');
          await executionsService.runFlow({
            flow,
            userId: flow.userId,
            triggeredBy: 'schedule',
            logger,
          });
        } catch (err) {
          logger.error({ err, flowId: flow.id }, 'Scheduled flow failed');
        }
      });
      scheduledFlows.set(flow.id, { task, interval: cronExpr });
    }

    // Remove flows that are no longer active
    for (const [id, entry] of scheduledFlows) {
      if (!activeIds.has(id)) {
        entry.task.stop();
        scheduledFlows.delete(id);
      }
    }
  } catch (err) {
    logger.error({ err }, 'Scheduler tick failed');
  }
}
