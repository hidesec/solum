import { ExceptionHandler, ControllerAdvice, getExceptionHandlers, getRegisteredAdvice, findMostSpecificHandler } from "../exception-handler.decorator";

class BaseError extends Error {}
class SpecificError extends BaseError {}
class OtherError extends Error {}

const handlers = [
    { exceptionType: Error, handlerName: "handleError" },
    { exceptionType: BaseError, handlerName: "handleBase" },
    { exceptionType: SpecificError, handlerName: "handleSpecific" },
];

describe("findMostSpecificHandler", () => {
    it("memilih handler dengan jarak pewarisan terdekat", () => {
        expect(findMostSpecificHandler(new SpecificError("x"), handlers)?.handlerName).toBe("handleSpecific");
        expect(findMostSpecificHandler(new BaseError("x"), handlers)?.handlerName).toBe("handleBase");
        expect(findMostSpecificHandler(new Error("x"), handlers)?.handlerName).toBe("handleError");
    });

    it("error di luar hirarki tetap jatuh ke handler paling umum (Error)", () => {
        expect(findMostSpecificHandler(new OtherError("x"), handlers)?.handlerName).toBe("handleError");
    });

    it("mengembalikan undefined saat tidak ada yang cocok atau daftar kosong", () => {
        const strict = [{ exceptionType: SpecificError, handlerName: "h" }];
        expect(findMostSpecificHandler(new OtherError("x"), strict)).toBeUndefined();
        expect(findMostSpecificHandler(new Error("x"), [])).toBeUndefined();
    });
});

class AdviceWithHandlers {
    @ExceptionHandler(BaseError)
    handleBase(err: BaseError): { caught: string } {
        return { caught: err.message };
    }
}

@ControllerAdvice()
class GlobalAdvice {}

describe("registry handler & advice", () => {
    it("@ExceptionHandler merekam definisi handler pada kelas", () => {
        const defs = getExceptionHandlers(AdviceWithHandlers);
        expect(defs).toHaveLength(1);
        expect(defs[0]).toMatchObject({ exceptionType: BaseError, handlerName: "handleBase" });
    });

    it("@ControllerAdvice mendaftarkan kelas ke registry global", () => {
        expect(getRegisteredAdvice()).toContain(GlobalAdvice);
    });
});
