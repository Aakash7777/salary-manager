import { Injectable } from '@nestjs/common';

const UTC_PLUS_14_IN_MS = 14 * 60 * 60 * 1000;

export abstract class Clock {
  abstract now(): Date;

  // "Today" is the latest calendar date anywhere on Earth (the date at UTC+14), so no user
  // in any timezone is wrongly told that their own local date is in the future.
  today(): string {
    return new Date(this.now().getTime() + UTC_PLUS_14_IN_MS).toISOString().slice(0, 10);
  }
}

@Injectable()
export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}

export class FixedClock extends Clock {
  private readonly instantInMs: number;

  constructor(instant: string | Date) {
    super();
    this.instantInMs = new Date(instant).getTime();
  }

  now(): Date {
    return new Date(this.instantInMs);
  }
}
