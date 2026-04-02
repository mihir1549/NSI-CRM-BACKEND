import { IsArray, IsUUID } from 'class-validator';

export class ReorderDto {
  @IsArray()
  @IsUUID('4', { each: true })
  orderedUuids: string[];
}
