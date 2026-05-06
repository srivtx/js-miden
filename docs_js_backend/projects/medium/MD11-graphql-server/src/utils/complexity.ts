import { GraphQLError } from 'graphql';
import type { ValidationContext, FieldNode, ASTVisitor } from 'graphql';
import { config } from '../config/index.js';

/**
 * Field complexity weights.
 * Simple fields cost 1, relational fields cost more.
 */
const COMPLEXITY_WEIGHTS: Record<string, number> = {
  users: 10,
  posts: 10,
  comments: 5,
  user: 3,
  post: 3,
  comment: 2,
  author: 5,
  me: 1,
};

/**
 * Calculates the complexity score of a query.
 * Each field has a weight, and nested fields multiply by their parent's cost.
 */
function calculateComplexity(node: FieldNode, depth = 0): number {
  const fieldName = node.name.value;
  const weight = COMPLEXITY_WEIGHTS[fieldName] ?? 1;
  
  // Deeper nesting increases complexity exponentially
  const depthMultiplier = Math.pow(1.5, depth);
  let total = weight * depthMultiplier;

  if (node.selectionSet) {
    for (const selection of node.selectionSet.selections) {
      if (selection.kind === 'Field') {
        total += calculateComplexity(selection, depth + 1);
      }
    }
  }

  return total;
}

/**
 * Apollo Server plugin for query complexity analysis.
 * Prevents expensive queries from executing.
 */
export const queryComplexityPlugin = {
  async requestDidStart() {
    return {
      async didResolveOperation({ request, document }) {
        if (!document) return;
        
        let totalComplexity = 0;
        
        for (const definition of document.definitions) {
          if (definition.kind === 'OperationDefinition') {
            for (const selection of definition.selectionSet.selections) {
              if (selection.kind === 'Field') {
                totalComplexity += calculateComplexity(selection, 0);
              }
            }
          }
        }

        if (totalComplexity > config.queryComplexityLimit) {
          throw new GraphQLError(
            `Query complexity ${totalComplexity.toFixed(0)} exceeds maximum ${config.queryComplexityLimit}. ` +
            `Reduce nesting depth or field selection.`,
            { extensions: { code: 'QUERY_TOO_COMPLEX' } }
          );
        }
      },
    };
  },
};

/**
 * Standalone complexity validator for use in tests.
 */
export function validateComplexity(document: { definitions: Array<{ kind: string; selectionSet?: { selections: Array<{ kind: string; name?: { value: string }; selectionSet?: { selections: unknown[] } }> } }> }): number {
  let total = 0;
  
  for (const definition of document.definitions) {
    if (definition.kind === 'OperationDefinition' && definition.selectionSet) {
      for (const selection of definition.selectionSet.selections) {
        if (selection.kind === 'Field' && selection.name) {
          total += calculateFieldComplexity(selection, 0);
        }
      }
    }
  }
  
  return total;
}

function calculateFieldComplexity(node: { name: { value: string }; selectionSet?: { selections: Array<{ kind: string; name?: { value: string }; selectionSet?: { selections: unknown[] } }> } }, depth: number): number {
  const weight = COMPLEXITY_WEIGHTS[node.name.value] ?? 1;
  const depthMultiplier = Math.pow(1.5, depth);
  let total = weight * depthMultiplier;

  if (node.selectionSet) {
    for (const selection of node.selectionSet.selections) {
      if (selection.kind === 'Field' && selection.name) {
        total += calculateFieldComplexity(selection, depth + 1);
      }
    }
  }

  return total;
}