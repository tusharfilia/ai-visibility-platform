import { Injectable } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';

export interface Cluster {
  id: string;
  centroid: number[];
  points: Array<{
    text: string;
    embedding: number[];
    distance: number;
  }>;
  size: number;
  label?: string;
  description?: string;
}

export interface ClusteringOptions {
  algorithm: 'dbscan' | 'kmeans' | 'hierarchical';
  minClusterSize?: number;
  maxClusters?: number;
  epsilon?: number; // For DBSCAN
  k?: number; // For K-Means
  similarityThreshold?: number;
}

export interface ClusteringResult {
  clusters: Cluster[];
  outliers: string[];
  algorithm: string;
  parameters: ClusteringOptions;
  quality: {
    silhouetteScore: number;
    cohesion: number;
    separation: number;
  };
}

@Injectable()
export class ClusteringService {
  constructor(private embeddingsService: EmbeddingsService) {}

  /**
   * Cluster prompts using specified algorithm
   */
  async clusterPrompts(
    prompts: Array<{ text: string; embedding: number[] }>,
    options: ClusteringOptions = { algorithm: 'dbscan' }
  ): Promise<ClusteringResult> {
    const { algorithm } = options;

    switch (algorithm) {
      case 'dbscan':
        return this.performDBSCAN(prompts, options);
      case 'kmeans':
        return this.performKMeans(prompts, options);
      case 'hierarchical':
        return this.performHierarchicalClustering(prompts, options);
      default:
        throw new Error(`Unsupported clustering algorithm: ${algorithm}`);
    }
  }

  /**
   * Perform DBSCAN clustering
   */
  private async performDBSCAN(
    prompts: Array<{ text: string; embedding: number[] }>,
    options: ClusteringOptions
  ): Promise<ClusteringResult> {
    const {
      epsilon = 0.3,
      minClusterSize = 2,
      similarityThreshold = 0.7
    } = options;

    const clusters: Cluster[] = [];
    const visited = new Set<number>();
    const outliers: string[] = [];
    let clusterId = 0;

    for (let i = 0; i < prompts.length; i++) {
      if (visited.has(i)) continue;

      const neighbors = this.findNeighbors(prompts, i, epsilon);
      
      if (neighbors.length < minClusterSize) {
        outliers.push(prompts[i].text);
        continue;
      }

      // Create new cluster
      const cluster: Cluster = {
        id: `cluster_${clusterId++}`,
        centroid: [],
        points: [],
        size: 0
      };

      // Expand cluster
      const queue = [...neighbors];
      visited.add(i);
      cluster.points.push({
        text: prompts[i].text,
        embedding: prompts[i].embedding,
        distance: 0
      });

      while (queue.length > 0) {
        const neighborIndex = queue.shift()!;
        if (visited.has(neighborIndex)) continue;

        visited.add(neighborIndex);
        cluster.points.push({
          text: prompts[neighborIndex].text,
          embedding: prompts[neighborIndex].embedding,
          distance: this.calculateDistance(prompts[i].embedding, prompts[neighborIndex].embedding)
        });

        // Find neighbors of this neighbor
        const neighborNeighbors = this.findNeighbors(prompts, neighborIndex, epsilon);
        if (neighborNeighbors.length >= minClusterSize) {
          queue.push(...neighborNeighbors.filter(idx => !visited.has(idx)));
        }
      }

      // Calculate centroid
      cluster.centroid = this.calculateCentroid(cluster.points.map(p => p.embedding));
      cluster.size = cluster.points.length;
      
      clusters.push(cluster);
    }

    return {
      clusters,
      outliers,
      algorithm: 'dbscan',
      parameters: options,
      quality: this.calculateQuality(clusters, prompts)
    };
  }

  /**
   * Perform K-Means clustering
   */
  private async performKMeans(
    prompts: Array<{ text: string; embedding: number[] }>,
    options: ClusteringOptions
  ): Promise<ClusteringResult> {
    const { k = 5, maxClusters = 10 } = options;
    const numClusters = Math.min(k, maxClusters, Math.floor(prompts.length / 2));

    if (numClusters <= 0) {
      return {
        clusters: [],
        outliers: prompts.map(p => p.text),
        algorithm: 'kmeans',
        parameters: options,
        quality: { silhouetteScore: 0, cohesion: 0, separation: 0 }
      };
    }

    // Initialize centroids randomly
    let centroids = this.initializeCentroids(prompts, numClusters);
    const clusters: Cluster[] = [];
    let iterations = 0;
    const maxIterations = 100;

    while (iterations < maxIterations) {
      // Assign points to nearest centroid
      const assignments = new Map<number, number[]>();
      for (let i = 0; i < numClusters; i++) {
        assignments.set(i, []);
      }

      prompts.forEach((prompt, index) => {
        let nearestCentroid = 0;
        let minDistance = Infinity;

        centroids.forEach((centroid, centroidIndex) => {
          const distance = this.calculateDistance(prompt.embedding, centroid);
          if (distance < minDistance) {
            minDistance = distance;
            nearestCentroid = centroidIndex;
          }
        });

        assignments.get(nearestCentroid)!.push(index);
      });

      // Update centroids
      const newCentroids = centroids.map((_, centroidIndex) => {
        const assignedPoints = assignments.get(centroidIndex)!;
        if (assignedPoints.length === 0) return centroids[centroidIndex];

        const embeddings = assignedPoints.map(index => prompts[index].embedding);
        return this.calculateCentroid(embeddings);
      });

      // Check for convergence
      const converged = centroids.every((centroid, index) => {
        const distance = this.calculateDistance(centroid, newCentroids[index]);
        return distance < 0.001;
      });

      centroids = newCentroids;

      if (converged) break;
      iterations++;
    }

    // Build final clusters
    centroids.forEach((centroid, centroidIndex) => {
      const assignedPoints = assignments.get(centroidIndex)!;
      
      if (assignedPoints.length > 0) {
        const cluster: Cluster = {
          id: `cluster_${centroidIndex}`,
          centroid,
          points: assignedPoints.map(index => ({
            text: prompts[index].text,
            embedding: prompts[index].embedding,
            distance: this.calculateDistance(prompts[index].embedding, centroid)
          })),
          size: assignedPoints.length
        };
        clusters.push(cluster);
      }
    });

    return {
      clusters,
      outliers: [],
      algorithm: 'kmeans',
      parameters: options,
      quality: this.calculateQuality(clusters, prompts)
    };
  }

  /**
   * Perform Hierarchical clustering
   */
  private async performHierarchicalClustering(
    prompts: Array<{ text: string; embedding: number[] }>,
    options: ClusteringOptions
  ): Promise<ClusteringResult> {
    const { maxClusters = 10 } = options;
    
    // Build distance matrix
    const distances: number[][] = [];
    for (let i = 0; i < prompts.length; i++) {
      distances[i] = [];
      for (let j = 0; j < prompts.length; j++) {
        if (i === j) {
          distances[i][j] = 0;
        } else {
          distances[i][j] = this.calculateDistance(prompts[i].embedding, prompts[j].embedding);
        }
      }
    }

    // Initialize clusters (each point is its own cluster)
    const clusters: Cluster[] = prompts.map((prompt, index) => ({
      id: `cluster_${index}`,
      centroid: prompt.embedding,
      points: [{
        text: prompt.text,
        embedding: prompt.embedding,
        distance: 0
      }],
      size: 1
    }));

    // Merge clusters until we reach desired number
    while (clusters.length > maxClusters) {
      // Find closest pair of clusters
      let minDistance = Infinity;
      let cluster1Index = -1;
      let cluster2Index = -1;

      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const distance = this.calculateDistance(clusters[i].centroid, clusters[j].centroid);
          if (distance < minDistance) {
            minDistance = distance;
            cluster1Index = i;
            cluster2Index = j;
          }
        }
      }

      if (cluster1Index === -1 || cluster2Index === -1) break;

      // Merge clusters
      const cluster1 = clusters[cluster1Index];
      const cluster2 = clusters[cluster2Index];
      
      const mergedCluster: Cluster = {
        id: `cluster_${clusters.length}`,
        centroid: this.calculateCentroid([
          ...cluster1.points.map(p => p.embedding),
          ...cluster2.points.map(p => p.embedding)
        ]),
        points: [...cluster1.points, ...cluster2.points],
        size: cluster1.size + cluster2.size
      };

      // Remove old clusters and add merged one
      clusters.splice(Math.max(cluster1Index, cluster2Index), 1);
      clusters.splice(Math.min(cluster1Index, cluster2Index), 1);
      clusters.push(mergedCluster);
    }

    return {
      clusters,
      outliers: [],
      algorithm: 'hierarchical',
      parameters: options,
      quality: this.calculateQuality(clusters, prompts)
    };
  }

  /**
   * Find neighbors within epsilon distance
   */
  private findNeighbors(
    prompts: Array<{ text: string; embedding: number[] }>,
    pointIndex: number,
    epsilon: number
  ): number[] {
    const neighbors: number[] = [];
    const pointEmbedding = prompts[pointIndex].embedding;

    prompts.forEach((prompt, index) => {
      if (index !== pointIndex) {
        const distance = this.calculateDistance(pointEmbedding, prompt.embedding);
        if (distance <= epsilon) {
          neighbors.push(index);
        }
      }
    });

    return neighbors;
  }

  /**
   * Calculate Euclidean distance between embeddings
   */
  private calculateDistance(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let sum = 0;
    for (let i = 0; i < embedding1.length; i++) {
      const diff = embedding1[i] - embedding2[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }

  /**
   * Calculate centroid of embeddings
   */
  private calculateCentroid(embeddings: number[][]): number[] {
    if (embeddings.length === 0) return [];

    const dimensions = embeddings[0].length;
    const centroid = new Array(dimensions).fill(0);

    embeddings.forEach(embedding => {
      embedding.forEach((value, index) => {
        centroid[index] += value;
      });
    });

    return centroid.map(sum => sum / embeddings.length);
  }

  /**
   * Initialize centroids randomly for K-Means
   */
  private initializeCentroids(
    prompts: Array<{ text: string; embedding: number[] }>,
    k: number
  ): number[][] {
    const centroids: number[][] = [];
    const usedIndices = new Set<number>();

    for (let i = 0; i < k; i++) {
      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * prompts.length);
      } while (usedIndices.has(randomIndex));

      usedIndices.add(randomIndex);
      centroids.push([...prompts[randomIndex].embedding]);
    }

    return centroids;
  }

  /**
   * Calculate clustering quality metrics
   */
  private calculateQuality(
    clusters: Cluster[],
    prompts: Array<{ text: string; embedding: number[] }>
  ): { silhouetteScore: number; cohesion: number; separation: number } {
    if (clusters.length === 0) {
      return { silhouetteScore: 0, cohesion: 0, separation: 0 };
    }

    // Calculate cohesion (average intra-cluster distance)
    let totalCohesion = 0;
    clusters.forEach(cluster => {
      if (cluster.points.length > 1) {
        let clusterCohesion = 0;
        cluster.points.forEach(point => {
          clusterCohesion += point.distance;
        });
        totalCohesion += clusterCohesion / cluster.points.length;
      }
    });
    const cohesion = totalCohesion / clusters.length;

    // Calculate separation (average inter-cluster distance)
    let totalSeparation = 0;
    let separationCount = 0;
    
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const distance = this.calculateDistance(clusters[i].centroid, clusters[j].centroid);
        totalSeparation += distance;
        separationCount++;
      }
    }
    const separation = separationCount > 0 ? totalSeparation / separationCount : 0;

    // Calculate silhouette score (simplified)
    const silhouetteScore = Math.max(0, Math.min(1, (separation - cohesion) / Math.max(separation, cohesion)));

    return {
      silhouetteScore,
      cohesion,
      separation
    };
  }

  /**
   * Validate clustering parameters
   */
  validateOptions(options: ClusteringOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (options.minClusterSize && options.minClusterSize < 1) {
      errors.push('minClusterSize must be at least 1');
    }

    if (options.maxClusters && options.maxClusters < 1) {
      errors.push('maxClusters must be at least 1');
    }

    if (options.epsilon && options.epsilon <= 0) {
      errors.push('epsilon must be positive');
    }

    if (options.k && options.k < 1) {
      errors.push('k must be at least 1');
    }

    if (options.similarityThreshold && (options.similarityThreshold < 0 || options.similarityThreshold > 1)) {
      errors.push('similarityThreshold must be between 0 and 1');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}