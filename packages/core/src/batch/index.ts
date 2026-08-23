import { getFrameworkLogger } from "../framework-logger";

export interface ItemReader<I> {
    read(): Promise<I | null>;
    open(): Promise<void>;
    close(): Promise<void>;
}

export interface ItemProcessor<I, O> {
    process(item: I): Promise<O | null>;
}

export interface ItemWriter<O> {
    write(items: O[]): Promise<void>;
    open(): Promise<void>;
    close(): Promise<void>;
}

export interface Chunk<I, O> {
    items: O[];
    count: number;
}

export class ArrayReader<I> implements ItemReader<I> {
    private index = 0;
    constructor(private items: I[]) {}
    async open(): Promise<void> { this.index = 0; }
    async read(): Promise<I | null> {
        if (this.index >= this.items.length) return null;
        return this.items[this.index++];
    }
    async close(): Promise<void> {}
}

export class FilterProcessor<I> implements ItemProcessor<I, I> {
    constructor(private predicate: (item: I) => boolean) {}
    async process(item: I): Promise<I | null> {
        return this.predicate(item) ? item : null;
    }
}

export class TransformProcessor<I, O> implements ItemProcessor<I, O> {
    constructor(private transform: (item: I) => O) {}
    async process(item: I): Promise<O> {
        return this.transform(item);
    }
}

export class ArrayWriter<O> implements ItemWriter<O> {
    private written: O[] = [];
    async open(): Promise<void> { this.written = []; }
    async write(items: O[]): Promise<void> { this.written.push(...items); }
    async close(): Promise<void> {}
    getWritten(): O[] { return [...this.written]; }
}

export interface Step<I, O> {
    name: string;
    reader: ItemReader<I>;
    processor?: ItemProcessor<I, O>;
    writer: ItemWriter<O>;
    chunkSize?: number;
}

export interface JobExecution {
    jobName: string;
    status: "COMPLETED" | "FAILED" | "STOPPED";
    startTime: number;
    endTime?: number;
    steps: StepExecution[];
    exitCode: string;
}

export interface StepExecution {
    stepName: string;
    readCount: number;
    writeCount: number;
    filterCount: number;
    commitCount: number;
    rollbackCount: number;
    status: "COMPLETED" | "FAILED" | "STOPPED";
}

export class StepBuilder<I, O> {
    private _name: string;
    private _reader!: ItemReader<I>;
    private _processor?: ItemProcessor<I, O>;
    private _writer!: ItemWriter<O>;
    private _chunkSize = 10;

    constructor(name: string) {
        this._name = name;
    }

    reader(reader: ItemReader<I>): this {
        this._reader = reader;
        return this;
    }

    processor(processor: ItemProcessor<I, O>): this {
        this._processor = processor;
        return this;
    }

    writer(writer: ItemWriter<O>): this {
        this._writer = writer;
        return this;
    }

    chunkSize(size: number): this {
        this._chunkSize = size;
        return this;
    }

    build(): Step<I, O> {
        if (!this._reader) throw new Error(`Step "${this._name}" requires a reader`);
        if (!this._writer) throw new Error(`Step "${this._name}" requires a writer`);
        return {
            name: this._name,
            reader: this._reader,
            processor: this._processor,
            writer: this._writer,
            chunkSize: this._chunkSize,
        };
    }
}

export class Job {
    private steps: Step<any, any>[] = [];

    constructor(public readonly name: string) {}

    addStep(step: Step<any, any>): this {
        this.steps.push(step);
        return this;
    }

    async execute(): Promise<JobExecution> {
        const execution: JobExecution = {
            jobName: this.name,
            status: "COMPLETED",
            startTime: Date.now(),
            steps: [],
            exitCode: "COMPLETED",
        };

        getFrameworkLogger().info({ job: this.name }, "Job started");

        for (const step of this.steps) {
            const stepExecution = await this.executeStep(step);
            execution.steps.push(stepExecution);

            if (stepExecution.status === "FAILED") {
                execution.status = "FAILED";
                execution.exitCode = "FAILED";
                break;
            }
        }

        execution.endTime = Date.now();
        getFrameworkLogger().info(
            { job: this.name, status: execution.status, duration: execution.endTime - execution.startTime },
            "Job finished"
        );

        return execution;
    }

    private async executeStep<I, O>(step: Step<I, O>): Promise<StepExecution> {
        const stepExec: StepExecution = {
            stepName: step.name,
            readCount: 0,
            writeCount: 0,
            filterCount: 0,
            commitCount: 0,
            rollbackCount: 0,
            status: "COMPLETED",
        };

        const chunkSize = step.chunkSize || 10;

        try {
            await step.reader.open();
            await step.writer.open();

            let chunk: any[] = [];

            while (true) {
                const item = await step.reader.read();
                if (item === null) break;

                stepExec.readCount++;

                let processed: any;
                if (step.processor) {
                    processed = await step.processor.process(item);
                    if (processed === null) {
                        stepExec.filterCount++;
                        continue;
                    }
                } else {
                    processed = item;
                }

                chunk.push(processed);

                if (chunk.length >= chunkSize) {
                    await step.writer.write(chunk);
                    stepExec.writeCount += chunk.length;
                    stepExec.commitCount++;
                    chunk = [];
                }
            }

            if (chunk.length > 0) {
                await step.writer.write(chunk);
                stepExec.writeCount += chunk.length;
                stepExec.commitCount++;
            }

            await step.reader.close();
            await step.writer.close();
        } catch (error) {
            stepExec.status = "FAILED";
            stepExec.rollbackCount++;
            getFrameworkLogger().error({ step: step.name, error: (error as Error).message }, "Step failed");
        }

        return stepExec;
    }
}

export function createJob(name: string): Job {
    return new Job(name);
}

export function createStep<I, O>(name: string): StepBuilder<I, O> {
    return new StepBuilder<I, O>(name);
}
