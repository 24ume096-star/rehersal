// Mock the prisma and redis modules before importing anything
jest.mock("../src/config/prisma", () => ({
  prisma: {},
}));

jest.mock("../src/config/redis", () => ({
  redis: {
    get: jest.fn(() => Promise.reject()),
    setex: jest.fn(() => Promise.resolve()),
    publish: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("../src/utils/cache", () => ({
  bumpVersion: jest.fn(() => Promise.resolve()),
  parkVersionKey: jest.fn(() => "park-key"),
  cityVersionKey: jest.fn(() => "city-key"),
}));

describe("gshiService.calculateGshi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calculates weighted GSHI and persists score", async () => {
    // Create a mock prisma client for testing
    const mockPrisma = {
      park: {
        findUnique: jest.fn(async () => ({ id: "park-1", cityId: "city-1", name: "Park 1" })),
      },
      satelliteImage: {
        findFirst: jest.fn(async () => ({
          id: "sat-1",
          source: "SENTINEL2",
          capturedAt: new Date("2026-04-01T00:00:00.000Z"),
          ndviMean: 0.5,
        })),
      },
      sensorReading: {
        aggregate: jest.fn(async () => ({
          _avg: { temperature: 30, humidity: 50, soilMoisture: 55, airQualityPM25: 25, airQualityPM10: 40, co2Level: 500 },
        })),
      },
      biodiversityLog: {
        findMany: jest.fn(async () => [
          { speciesName: "sparrow", count: 10, confidence: 0.95, conservationStatus: "NEAR_THREATENED" },
          { speciesName: "crow", count: 8, confidence: 0.9, conservationStatus: null },
          { speciesName: "myna", count: 6, confidence: 0.85, conservationStatus: null },
        ]),
      },
      treeScan: {
        findMany: jest.fn(async () => [
          { aiHealthScore: 82, scannedAt: new Date("2026-04-01T00:00:00.000Z") },
        ]),
      },
      gshiScore: {
        findFirst: jest.fn(async () => ({
          id: "g-old",
          overallScore: 70,
          infrastructureScore: 60,
        })),
        create: jest.fn(async (input) => ({ id: "g-new", ...input.data })),
      },
      alert: {
        create: jest.fn(async () => ({})),
        count: jest.fn(async () => 0),
      },
      sensorNode: {
        count: jest.fn(async (opts) => {
          if (opts?.where?.isActive === true && opts?.where?.status === "ONLINE") {
            return 8; // 8 of 10 nodes are online
          }
          return 10; // total nodes
        }),
      },
      citizenReport: {
        count: jest.fn(async () => 0),
      },
      floodEvent: {
        findFirst: jest.fn(async () => null),
      },
    };

    const { calculateGshi } = require("../src/services/gshiService");
    
    const result = await calculateGshi("park-1", { prismaClient: mockPrisma, infrastructureScore: 75 });

    console.log("Result:", result);
    expect(result.parkId).toBe("park-1");
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.vegetationScore).toBeGreaterThan(0);
    expect(result.treeHealthScore).toBeLessThanOrEqual(100);
    expect(mockPrisma.gshiScore.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.alert.create).not.toHaveBeenCalled();
  });

  it("creates alert when GSHI drops more than 10 points", async () => {
    const mockPrisma = {
      park: {
        findUnique: jest.fn(async () => ({ id: "park-1", cityId: "city-1", name: "Park 1" })),
      },
      satelliteImage: {
        findFirst: jest.fn(async () => ({
          id: "sat-1",
          source: "SENTINEL2",
          capturedAt: new Date("2026-04-01T00:00:00.000Z"),
          ndviMean: -0.2,
        })),
      },
      sensorReading: {
        aggregate: jest.fn(async () => ({
          _avg: { temperature: 41, humidity: 20, soilMoisture: 15, airQualityPM25: 70, airQualityPM10: 120, co2Level: 900 },
        })),
      },
      biodiversityLog: {
        findMany: jest.fn(async () => [{ speciesName: "crow", count: 1, confidence: 0.7, conservationStatus: null }]),
      },
      treeScan: {
        findMany: jest.fn(async () => [
          { aiHealthScore: 20, scannedAt: new Date("2026-04-01T00:00:00.000Z") },
        ]),
      },
      gshiScore: {
        findFirst: jest.fn(async () => ({
          id: "g-old",
          overallScore: 80,
          infrastructureScore: 50,
        })),
        create: jest.fn(async (input) => ({ id: "g-new", ...input.data })),
      },
      alert: {
        create: jest.fn(async () => ({ id: "a-1" })),
        count: jest.fn(async () => 5),
      },
      sensorNode: {
        count: jest.fn(async (opts) => {
          if (opts?.where?.isActive === true && opts?.where?.status === "ONLINE") {
            return 2; // only 2 of 10 nodes are online
          }
          return 10; // total nodes
        }),
      },
      citizenReport: {
        count: jest.fn(async () => 5),
      },
      floodEvent: {
        findFirst: jest.fn(async () => null),
      },
    };

    const { calculateGshi } = require("../src/services/gshiService");
    const result = await calculateGshi("park-1", { prismaClient: mockPrisma });

    console.log("Result for alert test:", result);
    expect(result.scoreDropFromLast).toBeGreaterThan(10);
    expect(mockPrisma.alert.create).toHaveBeenCalledTimes(1);
  });
});
