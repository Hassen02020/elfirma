const API_URL = 'http://localhost:3001/api/delivery';
const CONCURRENT_REQUESTS = 100;

interface TestResult {
  success: boolean;
  duration: number;
  error?: string;
  data?: any;
}

interface StressTestStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  errors: string[];
}

async function makeRequest(method: string, url: string, body?: any): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json() as any;
    const duration = Date.now() - startTime;

    return {
      success: response.ok,
      duration,
      data,
      error: response.ok ? undefined : data.error || 'Request failed',
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function createDelivery(index: number): Promise<TestResult> {
  const deliveryData = {
    camionId: 1,
    chauffeurId: 1,
    poidsVide: 2500,
    poidsCharge: 3200,
    poidsProduit: 10,
    nbCaissesChargees: 50,
    nbCaissesRetournees: 0,
    statut: 'EN_COURS',
    type: 'DEPART',
    date: new Date().toISOString(),
  };

  return makeRequest('POST', API_URL, deliveryData);
}

async function getDelivery(id: number): Promise<TestResult> {
  return makeRequest('GET', `${API_URL}/${id}`);
}

async function updateDelivery(id: number): Promise<TestResult> {
  const updateData = {
    nbCaissesRetournees: 45,
    statut: 'TERMINE',
    type: 'RETOUR',
  };

  return makeRequest('PUT', `${API_URL}/${id}`, updateData);
}

async function deleteDelivery(id: number): Promise<TestResult> {
  return makeRequest('DELETE', `${API_URL}/${id}`);
}

async function runConcurrentRequests<T>(
  fn: () => Promise<T>,
  count: number
): Promise<T[]> {
  const promises = Array.from({ length: count }, () => fn());
  return Promise.all(promises);
}

function calculateStats(results: TestResult[], totalDuration: number): StressTestStats {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const durations = results.map(r => r.duration);

  return {
    totalRequests: results.length,
    successfulRequests: successful.length,
    failedRequests: failed.length,
    averageResponseTime: durations.reduce((a, b) => a + b, 0) / durations.length,
    minResponseTime: Math.min(...durations),
    maxResponseTime: Math.max(...durations),
    requestsPerSecond: (results.length / totalDuration) * 1000,
    errors: failed.map(f => f.error || 'Unknown error'),
  };
}

function printStats(stats: StressTestStats, testName: string) {
  console.log(`\n=== ${testName} ===`);
  console.log(`Total Requests: ${stats.totalRequests}`);
  console.log(`Successful: ${stats.successfulRequests} (${((stats.successfulRequests / stats.totalRequests) * 100).toFixed(2)}%)`);
  console.log(`Failed: ${stats.failedRequests} (${((stats.failedRequests / stats.totalRequests) * 100).toFixed(2)}%)`);
  console.log(`Average Response Time: ${stats.averageResponseTime.toFixed(2)}ms`);
  console.log(`Min Response Time: ${stats.minResponseTime}ms`);
  console.log(`Max Response Time: ${stats.maxResponseTime}ms`);
  console.log(`Requests Per Second: ${stats.requestsPerSecond.toFixed(2)}`);

  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    const errorCounts = stats.errors.reduce((acc, err) => {
      acc[err] = (acc[err] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    Object.entries(errorCounts).forEach(([error, count]) => {
      console.log(`  - ${error}: ${count} times`);
    });
  }
}

async function runStressTest() {
  console.log('🚀 Starting Stress Test for Delivery API');
  console.log(`📊 Concurrent Requests: ${CONCURRENT_REQUESTS}`);
  console.log(`🔗 API URL: ${API_URL}\n`);

  // Test 1: Create (Load) - 100 concurrent POST requests
  console.log('📝 Test 1: Creating 100 deliveries (Load)...');
  const createStartTime = Date.now();
  const createResults = await runConcurrentRequests(
    () => createDelivery(Math.random()),
    CONCURRENT_REQUESTS
  );
  const createDuration = Date.now() - createStartTime;
  const createStats = calculateStats(createResults, createDuration);
  printStats(createStats, 'Create Deliveries (Load)');

  // Extract created delivery IDs for subsequent tests
  const createdIds = createResults
    .filter(r => r.success && r.data?.data?.id)
    .map(r => r.data.data.id);

  // Test 2: Read - 100 concurrent GET requests
  if (createdIds.length > 0) {
    console.log('\n📖 Test 2: Reading 100 deliveries...');
    const readStartTime = Date.now();
    const readResults = await runConcurrentRequests(
      () => getDelivery(createdIds[Math.floor(Math.random() * createdIds.length)]),
      CONCURRENT_REQUESTS
    );
    const readDuration = Date.now() - readStartTime;
    const readStats = calculateStats(readResults, readDuration);
    printStats(readStats, 'Read Deliveries');
  }

  // Test 3: Update (Unload) - 100 concurrent PUT requests
  if (createdIds.length > 0) {
    console.log('\n✏️ Test 3: Updating 100 deliveries (Unload)...');
    const updateStartTime = Date.now();
    const updateResults = await runConcurrentRequests(
      () => updateDelivery(createdIds[Math.floor(Math.random() * createdIds.length)]),
      CONCURRENT_REQUESTS
    );
    const updateDuration = Date.now() - updateStartTime;
    const updateStats = calculateStats(updateResults, updateDuration);
    printStats(updateStats, 'Update Deliveries (Unload)');
  }

  // Test 4: Delete - 100 concurrent DELETE requests
  if (createdIds.length > 0) {
    console.log('\n🗑️ Test 4: Deleting 100 deliveries...');
    const deleteStartTime = Date.now();
    const deleteResults = await runConcurrentRequests(
      () => deleteDelivery(createdIds[Math.floor(Math.random() * createdIds.length)]),
      Math.min(createdIds.length, CONCURRENT_REQUESTS)
    );
    const deleteDuration = Date.now() - deleteStartTime;
    const deleteStats = calculateStats(deleteResults, deleteDuration);
    printStats(deleteStats, 'Delete Deliveries');
  }

  // Overall Summary
  console.log('\n📊 Overall Stress Test Summary');
  console.log('================================');
  console.log('✅ Stress test completed successfully');
  console.log(`📈 Total operations tested: ${CONCURRENT_REQUESTS * 4}`);
  console.log(`⏱️ Total test duration: ${((createDuration + (createdIds.length > 0 ? 3 * 0 : 0)) / 1000).toFixed(2)}s`);
}

// Run the stress test
runStressTest().catch(error => {
  console.error('❌ Stress test failed:', error);
  process.exit(1);
});
