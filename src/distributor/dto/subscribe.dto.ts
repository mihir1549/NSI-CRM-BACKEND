import { IsNotEmpty, IsString } from 'class-validator';

export class SubscribeDto {
  @IsString()
  @IsNotEmpty()
  planUuid: string;
}
