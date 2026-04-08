import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CalendarNoteDto } from './dto/calendar-note.dto.js';

@Injectable()
export class DistributorCalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async getCalendar(distributorUuid: string, year: number, month: number) {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1); // exclusive upper bound

    const [activities, notes] = await Promise.all([
      this.prisma.leadActivity.findMany({
        where: {
          actorUuid: distributorUuid,
          followupAt: { gte: from, lt: to },
        },
        include: {
          lead: {
            select: {
              uuid: true,
              status: true,
              user: { select: { fullName: true } },
            },
          },
        },
      }),
      this.prisma.distributorCalendarNote.findMany({
        where: {
          distributorUuid,
          date: { gte: from, lt: to },
        },
      }),
    ]);

    type CalendarEvent = {
      date: string;
      type: 'FOLLOWUP' | 'PERSONAL_NOTE';
      title: string;
      time?: string;
      leadUuid?: string;
      leadStatus?: string;
      notes?: string;
      noteUuid?: string;
    };

    const events: CalendarEvent[] = [];

    for (const activity of activities) {
      if (!activity.followupAt) continue;
      const followupDate = activity.followupAt;
      const dateStr = followupDate.toISOString().slice(0, 10);
      const timeStr = followupDate.toISOString().slice(11, 19);

      events.push({
        date: dateStr,
        type: 'FOLLOWUP',
        title: `Follow up with ${activity.lead.user.fullName}`,
        leadUuid: activity.lead.uuid,
        leadStatus: activity.lead.status,
        notes: activity.notes ?? undefined,
        time: timeStr,
      });
    }

    for (const note of notes) {
      const dateStr = note.date.toISOString().slice(0, 10);
      events.push({
        date: dateStr,
        type: 'PERSONAL_NOTE',
        noteUuid: note.uuid,
        title: note.note.slice(0, 50),
        notes: note.note,
      });
    }

    // Sort by date ASC, then time ASC (nulls last)
    events.sort((a, b) => {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      const aTime = a.time ?? 'z';
      const bTime = b.time ?? 'z';
      return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
    });

    return { year, month, events };
  }

  async upsertNote(distributorUuid: string, dto: CalendarNoteDto) {
    // Normalize date to midnight UTC to avoid time drift issues
    const dateValue = new Date(dto.date + 'T00:00:00.000Z');

    const existing = await this.prisma.distributorCalendarNote.findFirst({
      where: { distributorUuid, date: dateValue },
    });

    if (existing) {
      return this.prisma.distributorCalendarNote.update({
        where: { uuid: existing.uuid },
        data: { note: dto.note },
      });
    }

    return this.prisma.distributorCalendarNote.create({
      data: { distributorUuid, date: dateValue, note: dto.note },
    });
  }

  async deleteNote(distributorUuid: string, noteUuid: string) {
    const existing = await this.prisma.distributorCalendarNote.findUnique({ where: { uuid: noteUuid } });
    if (!existing || existing.distributorUuid !== distributorUuid) {
      throw new NotFoundException('Note not found');
    }

    await this.prisma.distributorCalendarNote.delete({ where: { uuid: noteUuid } });
    return { message: 'Note deleted successfully' };
  }
}
