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

describe("gshiService.calculateGshi (unit)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("weights sum to 1.0", async () => {
    const { __private } = require("../src/services/gshiService");
    const parts = {
      vegetationScore: 100,
      thermalScore: 100,
      waterScore: 100,
      biodiversityScore: 100,
      airQualityScore: 100,
      infrastructureScore: 100,
      treeHealthScore: 100,
    };
    const overall = __private.computeWeightedOverall(parts);
    expect(overall).toBe(100);
  });

  it("handles missing sources (no satellite) by scoring vegetation 0", async () => {
    const mockPrisma = {
      park: { findUnique: jest.fn(async () => ({ id: "p-1", cityId: "c-1", name: "Park" })) },
      satelliteImage: { findFirst: jest.fn(async () => null) },
      sensorReading: { aggregate: jest.fn(async () => ({ _avg: { temperature: null, humidity: null, soilMoisture: null, airQualityPM25: null, airQualityPM10: null, co2Level: null } })) },
      biodiversityLog: { findMany: jest.fn(async () => []) },
      treeScan: { findMany: jest.fn(async () => []) },
      gshiScore: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async (input) => ({ id: "g-1", ...input.data })),
      },
      alert: {
        create: jest.fn(async () => ({})),
        count: jest.fn(async () => 0),
      },
      sensorNode: {
        count: jest.fn(async () => 10),
      },
      citizenReport: {
        count: jest.fn(async () => 0),
      },
      floodEvent: {
        findFirst: jest.fn(async () => null),
      },
    };

    const { calculateGshi } = require("../src/services/gshiService");
    const r = await calculateGshi("p-1", { prismaClient: mockPrisma });
    expect(r.vegetationScore).toBe(0);
    expect(mockPrisma.gshiScore.create).toHaveBeenCalledTimes(1);
  });
});

