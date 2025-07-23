// import { normalizeFilePath } from "@gaubee/node";
// import { promises as fs } from "node:fs";
// import { beforeEach, describe, expect, it, vi } from "vitest";
// import { PluginContext, ResolvedAsset } from "../core/types";
// import { copy } from "./copy";

// // Mock fs.promises
// vi.mock("node:fs", async (importOriginal) => {
//   const originalFs = await importOriginal<typeof import("node:fs")>();
//   return {
//     ...originalFs,
//     promises: {
//       ...originalFs.promises,
//       readdir: vi.fn(),
//       rename: vi.fn(),
//       mkdir: vi.fn(),
//     },
//   };
// });

// describe("rename Plugin", () => {
//   let mockContext: PluginContext;

//   beforeEach(() => {
//     vi.clearAllMocks();
//     mockContext = {
//       tag: "v1.0.0",
//       downloadedFilePath: "",
//       tempDir: normalizeFilePath("/tmp/test-rename"),
//       asset: {
//         targetPath: normalizeFilePath("/dest/binary.exe"),
//       } as ResolvedAsset,
//     };
//   });

//   it("should find and rename the file in the root of tempDir", async () => {
//     const mockDirentries = [{ name: "binary.exe", isDirectory: () => false }];
//     vi.mocked(fs.readdir).mockResolvedValue(mockDirentries as any);

//     await copy({ from: "binary.exe" })(mockContext);

//     expect(fs.rename).toHaveBeenCalledWith(
//       normalizeFilePath("/tmp/test-rename/binary.exe"),
//       normalizeFilePath("/dest/binary.exe"),
//     );
//   });

//   it("should find and rename the file in a subdirectory", async () => {
//     const rootDirentries = [{ name: "sub", isDirectory: () => true }];
//     const subDirentries = [{ name: "binary.exe", isDirectory: () => false }];
//     vi.mocked(fs.readdir)
//       .mockResolvedValueOnce(rootDirentries as any)
//       .mockResolvedValueOnce(subDirentries as any);

//     await copy({ from: "binary.exe" })(mockContext);

//     const tempDir = normalizeFilePath("/tmp/test-rename");
//     const subDir = normalizeFilePath("/tmp/test-rename/sub");

//     expect(fs.readdir).toHaveBeenCalledWith(tempDir, { withFileTypes: true });
//     expect(fs.readdir).toHaveBeenCalledWith(subDir, { withFileTypes: true });
//     expect(fs.rename).toHaveBeenCalledWith(
//       normalizeFilePath("/tmp/test-rename/sub/binary.exe"),
//       normalizeFilePath("/dest/binary.exe"),
//     );
//   });

//   it("should throw an error if the file is not found", async () => {
//     vi.mocked(fs.readdir).mockResolvedValue([]); // Simulate empty directory

//     const promise = copy({ from: "nonexistent.exe" })(mockContext);

//     await expect(promise).rejects.toThrow(
//       `[Plugin:rename] Could not find 'nonexistent.exe' in ${normalizeFilePath("/tmp/test-rename")}`,
//     );
//     expect(fs.rename).not.toHaveBeenCalled();
//   });

//   it("should create the destination directory if it does not exist", async () => {
//     const mockDirentries = [{ name: "binary.exe", isDirectory: () => false }];
//     vi.mocked(fs.readdir).mockResolvedValue(mockDirentries as any);

//     await copy({ from: "binary.exe" })(mockContext);

//     expect(fs.mkdir).toHaveBeenCalledWith(normalizeFilePath("/dest"), { recursive: true });
//   });
// });
