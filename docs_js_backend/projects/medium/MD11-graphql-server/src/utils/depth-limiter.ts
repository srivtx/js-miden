import { GraphQLError } from 'graphql';
import type { ValidationContext, ASTNode, FieldNode, InlineFragmentNode, FragmentSpreadNode } from 'graphql';
import { config } from '../config/index.js';

/**
 * Calculates the depth of a GraphQL query.
 * Recursively traverses the AST to find the maximum nesting depth.
 */
function calculateDepth(node: ASTNode, depth = 0): number {
  if (depth > config.queryDepthLimit) {
    return depth;
  }

  if (node.kind === 'Field') {
    const fieldNode = node as FieldNode;
    if (!fieldNode.selectionSet) {
      return depth;
    }
    let maxDepth = depth;
    for (const selection of fieldNode.selectionSet.selections) {
      const childDepth = calculateDepth(selection, depth + 1);
      if (childDepth > maxDepth) {
        maxDepth = childDepth;
      }
    }
    return maxDepth;
  }

  if (node.kind === 'InlineFragment') {
    const inlineFragment = node as InlineFragmentNode;
    if (!inlineFragment.selectionSet) {
      return depth;
    }
    let maxDepth = depth;
    for (const selection of inlineFragment.selectionSet.selections) {
      const childDepth = calculateDepth(selection, depth);
      if (childDepth > maxDepth) {
        maxDepth = childDepth;
      }
    }
    return maxDepth;
  }

  if (node.kind === 'FragmentSpread') {
    return depth;
  }

  if (node.kind === 'SelectionSet') {
    let maxDepth = depth;
    for (const selection of node.selections) {
      const childDepth = calculateDepth(selection, depth + 1);
      if (childDepth > maxDepth) {
        maxDepth = childDepth;
      }
    }
    return maxDepth;
  }

  if (node.kind === 'OperationDefinition') {
    let maxDepth = depth;
    if (node.selectionSet) {
      for (const selection of node.selectionSet.selections) {
        const childDepth = calculateDepth(selection, depth + 1);
        if (childDepth > maxDepth) {
          maxDepth = childDepth;
        }
      }
    }
    return maxDepth;
  }

  return depth;
}

/**
 * GraphQL validation rule that limits query depth.
 * Prevents recursive/deeply nested queries that could crash the server.
 * 
 * BUG INTRODUCED: The depth limit check is commented out below.
 * This allows recursive queries like:
 * query { user(id: "1") { posts { author { posts { author { posts { ... } } } } } } }
 * which will cause stack overflow or DB exhaustion.
 */
export function queryDepthLimiter(context: ValidationContext) {
  return {
    Document(node) {
      const documentDepth = calculateDepth(node, 0);
      
      // BUG: Depth limit check disabled - allows recursive queries to crash server
      // if (documentDepth > config.queryDepthLimit) {
      //   context.reportError(
      //     new GraphQLError(
      //       `Query exceeds maximum depth of ${config.queryDepthLimit}. Actual depth: ${documentDepth}`,
      //       { nodes: [node] }
      //     )
      //   );
      // }
      
      // Intentionally allowing any depth through
      return undefined;
    },
  };
}

// Export for testing
export { calculateDepth };