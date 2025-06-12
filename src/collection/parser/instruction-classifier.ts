import { SYSTEM_PROGRAMS } from '../../constant/dex_config.ts';
import { ClassifiedInstruction } from '../../type/common.ts';
import { TransactionAdapter } from './transaction-adapter.ts';

export class InstructionClassifier {
  private instructionMap: Map<string, ClassifiedInstruction[]> = new Map();

  constructor(private adapter: TransactionAdapter) {
    this.classifyInstructions();
  }

  private classifyInstructions() {
    // outer instructions
    this.adapter.instructions.forEach((instruction: any, outerIndex: any) => {
      const programId = this.adapter.getInstructionProgramId(instruction);
      this.addInstruction({
        instruction,
        programId,
        outerIndex,
      });
    });

    // innerInstructions
    const innerInstructions = this.adapter.innerInstructions;
    if (innerInstructions) {
      innerInstructions.forEach((set: any) => {
        set.instructions.forEach((instruction: any, innerIndex: any) => {
          const programId = this.adapter.getInstructionProgramId(instruction);
          this.addInstruction({
            instruction,
            programId,
            outerIndex: set.index,
            innerIndex,
          });
        });
      });
    }
  }

  private addInstruction(classified: ClassifiedInstruction) {
    if (!classified.programId) return;

    const instructions = this.instructionMap.get(classified.programId) || [];
    instructions.push(classified);
    this.instructionMap.set(classified.programId, instructions);
  }

  public getInstructions(programId: string): ClassifiedInstruction[] {
    return this.instructionMap.get(programId) || [];
  }

  public getAllProgramIds(): string[] {
    return Array.from(this.instructionMap.keys()).filter((it) => !SYSTEM_PROGRAMS.includes(it));
  }
}
