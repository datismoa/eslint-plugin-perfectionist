import type { TSESTree } from '@typescript-eslint/types'
import type { TSESLint } from '@typescript-eslint/utils'

import { ASTUtils } from '@typescript-eslint/utils'

import type { PartitionComment } from '../typings'

import { extractStickedComments } from './extract-sticked-comments'
import { isPartitionComment } from './is-partition-comment'

export let getNodeRange = (
  node: TSESTree.Node,
  sourceCode: TSESLint.SourceCode,
  additionalOptions?: {
    partitionComment?: PartitionComment
  },
): TSESTree.Range => {
  let start = node.range.at(0)!
  let end = node.range.at(1)!

  let raw = sourceCode.text.slice(start, end)

  if (ASTUtils.isParenthesized(node, sourceCode)) {
    let bodyOpeningParen = sourceCode.getTokenBefore(
      node,
      ASTUtils.isOpeningParenToken,
    )!

    let bodyClosingParen = sourceCode.getTokenAfter(
      node,
      ASTUtils.isClosingParenToken,
    )!

    start = bodyOpeningParen.range.at(0)!
    end = bodyClosingParen.range.at(1)!
  }

  let comments = extractStickedComments(node, sourceCode)

  let hasAtLeastOneComment = comments.length > 0

  if (raw.endsWith(';') || raw.endsWith(',')) {
    let tokensAfter = sourceCode.getTokensAfter(node, {
      includeComments: true,
      count: 2,
    })

    if (node.loc.start.line === tokensAfter.at(1)?.loc.start.line) {
      end -= 1
    }
  }

  if (
    hasAtLeastOneComment &&
    !isPartitionComment(
      additionalOptions?.partitionComment ?? false,
      comments.at(-1)!.value,
    )
  ) {
    start = comments.at(0)!.range.at(0)!
  }

  return [start, end]
}