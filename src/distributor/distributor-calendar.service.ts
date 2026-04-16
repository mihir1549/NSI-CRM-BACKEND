import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CalendarNoteDto } from './dto/calendar-note.dto.js';
import type { UpdateCalendarNoteDto } from './dto/update-calendar-note.dto.js';

@Injectable()
export class DistributorCalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async getCalendar(distributorUuid: string, year: number, month: number) {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1); // exclusive upper bound

    const [activities, notes, tasks] = await Promise.all([
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
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
      }),
      this.prisma.distributorTask.findMany({
        where: {
          distributorUuid,
          dueDate: { gte: from, lt: to },
        },
        orderBy: { dueDate: 'asc' },
      }),
    ]);

    type CalendarEvent = {
      uuid: string;
      type: 'FOLLOWUP' | 'NOTE' | 'TASK';
      date: Date;
      time: string | null;
      content: string | null;
      title: string | null;
      status: string | null;
      leadUuid?: string;
      leadStatus?: string;
    };

    const events: CalendarEvent[] = [];

    for (const activity of activities) {
      if (!activity.followupAt) continue;
      const followupDate = activity.followupAt;
      events.push({
        uuid: activity.uuid,
        type: 'FOLLOWUP',
        date: followupDate,
        time: followupDate.toISOString().slice(11, 16),
        content: activity.notes ?? null,
        title: `Follow up with ${activity.lead.user.fullName}`,
        status: null,
        leadUuid: activity.lead.uuid,
        leadStatus: activity.lead.status,
      });
    }

    for (const note of notes) {
      events.push({
        uuid: note.uuid,
        type: 'NOTE',
        date: note.date,
        time: note.time ?? null,
        content: note.note,
        title: null,
        status: null,
      });
    }

    for (const task of tasks) {
      events.push({
        uuid: task.uuid,
        type: 'TASK',
        date: task.dueDate!,
        time: null,
        content: null,
        title: task.title,
        status: task.status,
      });
    }

    // Sort by date, then by time (nulls last within same date)
    events.sort((a, b) => {
      const dateCompare =
        new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1; // timed items before untimed
      if (b.time) return 1;
      return 0;
    });

    return { year, month, events };
  }

  async createNote(distributorUuid: string, dto: CalendarNoteDto) {
    // Always create a new note (replaces upsert) — allows multiple notes per day
    const dateValue = new Date(dto.date + 'T00:00:00.000Z');

    return this.prisma.distributorCalendarNote.create({
      data: {
        distributorUuid,
        date: dateValue,
        note: dto.note,
        time: dto.time ?? null,
      },
    });
  }

  async getNoteForEdit(distributorUuid: string, noteUuid: string) {
    const note = await this.prisma.distributorCalendarNote.findFirst({
      where: { uuid: noteUuid, distributorUuid },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    return {
      uuid: note.uuid,
      date: note.date,
      time: note.time,
      note: note.note,
    };
  }

  async updateNote(
    distributorUuid: string,
    noteUuid: string,
    dto: UpdateCalendarNoteDto,
  ) {
    const note = await this.prisma.distributorCalendarNote.findFirst({
      where: { uuid: noteUuid, distributorUuid },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    return this.prisma.distributorCalendarNote.update({
      where: { uuid: noteUuid },
      data: {
        ...(dto.note !== undefined && { note: dto.note }),
        ...(dto.time !== undefined && { time: dto.time }),
        ...(dto.date !== undefined && {
          date: new Date(dto.date + 'T00:00:00.000Z'),
        }),
      },
    });
  }

  async deleteNote(distributorUuid: string, noteUuid: string) {
    const existing = await this.prisma.distributorCalendarNote.findUnique({
      where: { uuid: noteUuid },
    });
    if (!existing || existing.distributorUuid !== distributorUuid) {
      throw new NotFoundException('Note not found');
    }

    await this.prisma.distributorCalendarNote.delete({
      where: { uuid: noteUuid },
    });
    return { message: 'Note deleted successfully' };
  }
}
