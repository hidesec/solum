import {
    ArrayReader,
    FilterProcessor,
    TransformProcessor,
    ArrayWriter,
    StepBuilder,
    Job,
    createJob,
    createStep,
} from "../batch/index";

describe("ArrayReader", () => {
    it("reads items sequentially", async () => {
        const reader = new ArrayReader([1, 2, 3]);
        await reader.open();
        expect(await reader.read()).toBe(1);
        expect(await reader.read()).toBe(2);
        expect(await reader.read()).toBe(3);
        expect(await reader.read()).toBeNull();
    });

    it("returns null on empty array", async () => {
        const reader = new ArrayReader([]);
        await reader.open();
        expect(await reader.read()).toBeNull();
    });

    it("resets index on open", async () => {
        const reader = new ArrayReader([1, 2]);
        await reader.open();
        await reader.read();
        await reader.open();
        expect(await reader.read()).toBe(1);
    });
});

describe("FilterProcessor", () => {
    it("returns item when predicate passes", async () => {
        const proc = new FilterProcessor<number>((n) => n > 2);
        expect(await proc.process(3)).toBe(3);
    });

    it("returns null when predicate fails", async () => {
        const proc = new FilterProcessor<number>((n) => n > 2);
        expect(await proc.process(1)).toBeNull();
    });
});

describe("TransformProcessor", () => {
    it("transforms item", async () => {
        const proc = new TransformProcessor<number, string>((n) => `item-${n}`);
        expect(await proc.process(5)).toBe("item-5");
    });
});

describe("ArrayWriter", () => {
    it("collects written items", async () => {
        const writer = new ArrayWriter<number>();
        await writer.open();
        await writer.write([1, 2, 3]);
        await writer.write([4, 5]);
        expect(writer.getWritten()).toEqual([1, 2, 3, 4, 5]);
    });

    it("resets on open", async () => {
        const writer = new ArrayWriter<number>();
        await writer.write([1, 2]);
        await writer.open();
        expect(writer.getWritten()).toEqual([]);
    });

    it("getWritten returns a copy", async () => {
        const writer = new ArrayWriter<number>();
        await writer.write([1]);
        const copy = writer.getWritten();
        copy.push(99);
        expect(writer.getWritten()).toEqual([1]);
    });
});

describe("StepBuilder", () => {
    it("builds a step with reader, writer", () => {
        const step = createStep<number, number>("step1")
            .reader(new ArrayReader([1, 2, 3]))
            .writer(new ArrayWriter<number>())
            .build();
        expect(step.name).toBe("step1");
        expect(step.chunkSize).toBe(10);
    });

    it("sets custom chunk size", () => {
        const step = createStep<number, number>("step2")
            .reader(new ArrayReader([]))
            .writer(new ArrayWriter())
            .chunkSize(5)
            .build();
        expect(step.chunkSize).toBe(5);
    });

    it("throws when reader missing", () => {
        expect(() => createStep("bad").writer(new ArrayWriter()).build()).toThrow("requires a reader");
    });

    it("throws when writer missing", () => {
        expect(() => createStep("bad").reader(new ArrayReader([])).build()).toThrow("requires a writer");
    });
});

describe("Job", () => {
    it("executes a step with items", async () => {
        const step = createStep("copy")
            .reader(new ArrayReader([10, 20, 30]))
            .writer(new ArrayWriter<number>())
            .build();

        const job = createJob("test-job");
        job.addStep(step);
        const execution = await job.execute();

        expect(execution.jobName).toBe("test-job");
        expect(execution.status).toBe("COMPLETED");
        expect(execution.steps).toHaveLength(1);
        expect(execution.steps[0].readCount).toBe(3);
        expect(execution.steps[0].writeCount).toBe(3);
    });

    it("applies filter processor", async () => {
        const step = createStep("filter")
            .reader(new ArrayReader([1, 2, 3, 4, 5]))
            .processor(new FilterProcessor<number>((n) => n % 2 === 0))
            .writer(new ArrayWriter<number>())
            .chunkSize(10)
            .build();

        const job = createJob("filter-job");
        job.addStep(step);
        const execution = await job.execute();

        expect(execution.steps[0].readCount).toBe(5);
        expect(execution.steps[0].filterCount).toBe(3);
        expect(execution.steps[0].writeCount).toBe(2);
    });

    it("applies transform processor", async () => {
        const step = createStep("transform")
            .reader(new ArrayReader([1, 2, 3]))
            .processor(new TransformProcessor<number, string>((n) => `item-${n}`))
            .writer(new ArrayWriter<string>())
            .build();

        const job = createJob("transform-job");
        job.addStep(step);
        const execution = await job.execute();

        expect(execution.steps[0].writeCount).toBe(3);
    });

    it("handles empty reader", async () => {
        const step = createStep("empty")
            .reader(new ArrayReader([]))
            .writer(new ArrayWriter<number>())
            .build();

        const job = createJob("empty-job");
        job.addStep(step);
        const execution = await job.execute();

        expect(execution.status).toBe("COMPLETED");
        expect(execution.steps[0].readCount).toBe(0);
    });

    it("respects chunkSize", async () => {
        const writer = new ArrayWriter<number>();
        const step = createStep("chunked")
            .reader(new ArrayReader([1, 2, 3, 4, 5]))
            .writer(writer)
            .chunkSize(2)
            .build();

        const job = createJob("chunk-job");
        job.addStep(step);
        await job.execute();

        expect(writer.getWritten()).toEqual([1, 2, 3, 4, 5]);
    });

    it("marks FAILED when step throws", async () => {
        const failingReader = {
            open: jest.fn(),
            close: jest.fn(),
            read: jest.fn().mockRejectedValue(new Error("boom")),
        };
        const step = createStep("fail-step")
            .reader(failingReader)
            .writer(new ArrayWriter())
            .build();

        const job = createJob("fail-job");
        job.addStep(step);
        const execution = await job.execute();

        expect(execution.status).toBe("FAILED");
        expect(execution.steps[0].status).toBe("FAILED");
        expect(execution.steps[0].rollbackCount).toBe(1);
    });
});
