import {
    AggregateRoot,
    saveEvents,
    getEvents,
    getEventsByType,
    getAllEvents,
    getEventsAfterVersion,
    saveSnapshot,
    getSnapshot,
    loadAggregate,
    clearEventStore,
    registerEventApplier,
    subscribeToEvents,
    replayEvents,
} from "../event-sourcing/index";

class TestAggregate extends AggregateRoot {
    public state: Record<string, unknown> = {};

    applyItemAdded(item: string) {
        this.apply("ItemAdded", { item });
    }

    applyItemRemoved(item: string) {
        this.apply("ItemRemoved", { item });
    }
}

describe("Event Sourcing", () => {
    beforeEach(() => {
        clearEventStore();
    });

    describe("AggregateRoot", () => {
        it("starts at version 0", () => {
            const agg = new TestAggregate("agg-1", "Order");
            expect(agg.version).toBe(0);
        });

        it("tracks uncommitted events", () => {
            const agg = new TestAggregate("agg-1", "Order");
            agg.applyItemAdded("item-1");
            const uncommitted = agg.getUncommittedEvents();
            expect(uncommitted).toHaveLength(1);
            expect(uncommitted[0].eventType).toBe("ItemAdded");
            expect(uncommitted[0].data).toEqual({ item: "item-1" });
            expect(uncommitted[0].version).toBe(1);
        });

        it("increments version on apply", () => {
            const agg = new TestAggregate("agg-1", "Order");
            agg.applyItemAdded("a");
            agg.applyItemAdded("b");
            expect(agg.version).toBe(2);
        });

        it("markEventsAsCommitted clears uncommitted", () => {
            const agg = new TestAggregate("agg-1", "Order");
            agg.applyItemAdded("a");
            agg.markEventsAsCommitted();
            expect(agg.getUncommittedEvents()).toHaveLength(0);
        });

        it("loadFromHistory applies events", () => {
            const agg = new TestAggregate("agg-1", "Order");
            const events = [
                { id: "e1", aggregateId: "agg-1", aggregateType: "Order", eventType: "ItemAdded", data: { item: "a" }, version: 1, timestamp: 1 },
                { id: "e2", aggregateId: "agg-1", aggregateType: "Order", eventType: "ItemAdded", data: { item: "b" }, version: 2, timestamp: 2 },
            ];
            agg.loadFromHistory(events);
            expect(agg.version).toBe(2);
        });
    });

    describe("saveEvents and getEvents", () => {
        it("saves and retrieves events by aggregate", async () => {
            const agg = new TestAggregate("agg-1", "Order");
            agg.applyItemAdded("x");
            const events = agg.getUncommittedEvents();

            await saveEvents("agg-1", "Order", events);
            const found = getEvents("agg-1");
            expect(found).toHaveLength(1);
            expect(found[0].data).toEqual({ item: "x" });
        });

        it("getEvents returns empty for unknown aggregate", () => {
            expect(getEvents("unknown")).toEqual([]);
        });
    });

    describe("getEventsByType", () => {
        it("filters events by type", async () => {
            const agg = new TestAggregate("agg-1", "Order");
            agg.applyItemAdded("a");
            agg.applyItemRemoved("b");
            await saveEvents("agg-1", "Order", agg.getUncommittedEvents());

            expect(getEventsByType("ItemAdded")).toHaveLength(1);
            expect(getEventsByType("ItemRemoved")).toHaveLength(1);
            expect(getEventsByType("Unknown")).toHaveLength(0);
        });
    });

    describe("getAllEvents", () => {
        it("returns all events", async () => {
            const agg = new TestAggregate("agg-1", "Order");
            agg.applyItemAdded("a");
            await saveEvents("agg-1", "Order", agg.getUncommittedEvents());
            expect(getAllEvents()).toHaveLength(1);
        });
    });

    describe("getEventsAfterVersion", () => {
        it("returns events after given version", async () => {
            const agg = new TestAggregate("agg-1", "Order");
            agg.applyItemAdded("a");
            agg.applyItemAdded("b");
            agg.applyItemAdded("c");
            await saveEvents("agg-1", "Order", agg.getUncommittedEvents());

            expect(getEventsAfterVersion("agg-1", 1)).toHaveLength(2);
            expect(getEventsAfterVersion("agg-1", 0)).toHaveLength(3);
            expect(getEventsAfterVersion("agg-1", 3)).toHaveLength(0);
        });
    });

    describe("snapshots", () => {
        it("saveSnapshot and getSnapshot", () => {
            saveSnapshot("agg-1", "Order", { count: 5 }, 10);
            const snap = getSnapshot("agg-1");
            expect(snap).toBeDefined();
            expect(snap!.state).toEqual({ count: 5 });
            expect(snap!.version).toBe(10);
        });

        it("getSnapshot returns undefined for unknown", () => {
            expect(getSnapshot("unknown")).toBeUndefined();
        });
    });

    describe("loadAggregate", () => {
        it("loads from snapshot and subsequent events", async () => {
            const agg = new TestAggregate("agg-1", "Order");
            agg.applyItemAdded("a");
            agg.applyItemAdded("b");
            agg.applyItemAdded("c");
            await saveEvents("agg-1", "Order", agg.getUncommittedEvents());
            saveSnapshot("agg-1", "Order", { count: 3 }, 3);

            const loaded = loadAggregate("agg-1", "Order", (id) => new TestAggregate(id, "Order"));
            expect(loaded.version).toBe(3);
        });

        it("loads without snapshot", async () => {
            const agg = new TestAggregate("agg-1", "Order");
            agg.applyItemAdded("a");
            await saveEvents("agg-1", "Order", agg.getUncommittedEvents());

            const loaded = loadAggregate("agg-1", "Order", (id) => new TestAggregate(id, "Order"));
            expect(loaded.version).toBe(1);
        });
    });

    describe("replayEvents", () => {
        it("returns events within version range", async () => {
            const agg = new TestAggregate("agg-1", "Order");
            agg.applyItemAdded("a");
            agg.applyItemAdded("b");
            agg.applyItemAdded("c");
            await saveEvents("agg-1", "Order", agg.getUncommittedEvents());

            expect(replayEvents("agg-1", 0, 2)).toHaveLength(2);
            expect(replayEvents("agg-1", 1, 2)).toHaveLength(1);
            expect(replayEvents("agg-1", 0)).toHaveLength(3);
        });
    });

    describe("event handlers", () => {
        it("calls subscribed handlers on saveEvents", async () => {
            const handler = jest.fn();
            subscribeToEvents("ItemAdded", handler);

            const agg = new TestAggregate("agg-1", "Order");
            agg.applyItemAdded("x");
            await saveEvents("agg-1", "Order", agg.getUncommittedEvents());

            expect(handler).toHaveBeenCalledWith(expect.objectContaining({ eventType: "ItemAdded" }));
        });

        it("handles handler errors gracefully", async () => {
            subscribeToEvents("ItemAdded", () => { throw new Error("handler error"); });
            const agg = new TestAggregate("agg-1", "Order");
            agg.applyItemAdded("x");
            await expect(saveEvents("agg-1", "Order", agg.getUncommittedEvents())).resolves.toBeUndefined();
        });
    });

    describe("registerEventApplier", () => {
        it("registers and applies events to aggregate", async () => {
            registerEventApplier("ItemAdded", (state: any, event) => ({
                ...state,
                items: [...(state.items || []), (event.data as any).item],
            }));

            const agg = new TestAggregate("agg-1", "Order");
            const events = [
                { id: "e1", aggregateId: "agg-1", aggregateType: "Order", eventType: "ItemAdded", data: { item: "a" }, version: 1, timestamp: 1 },
            ];
            agg.loadFromHistory(events);
            expect((agg as any)._state.items).toEqual(["a"]);
        });
    });

    describe("clearEventStore", () => {
        it("clears all events, snapshots, and handlers", async () => {
            const agg = new TestAggregate("agg-1", "Order");
            agg.applyItemAdded("a");
            await saveEvents("agg-1", "Order", agg.getUncommittedEvents());
            saveSnapshot("agg-1", "Order", {}, 1);

            clearEventStore();
            expect(getAllEvents()).toEqual([]);
            expect(getSnapshot("agg-1")).toBeUndefined();
        });
    });
});
