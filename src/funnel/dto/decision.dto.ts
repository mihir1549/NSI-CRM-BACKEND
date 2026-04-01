import { IsIn, IsString } from 'class-validator';

export class DecisionDto {
  @IsIn(['YES', 'NO'])
  answer!: 'YES' | 'NO';

  @IsString()
  stepUuid!: string;
}
