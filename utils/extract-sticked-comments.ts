import type { TSESLint, TSESTree } from '@typescript-eslint/utils'

import { getOffsetBetweenLocations } from './get-offset-between-locations'

export let extractStickedComments = (node: TSESTree.Node, source: TSESLint.SourceCode) => {
  let comments = source.getCommentsBefore(node)
  let [firstComment, ...nextComments] = comments
  let lastComment = comments.at(-1)

  if (!firstComment || getOffsetBetweenLocations(lastComment!.loc, node.loc) !== 1) {
    return []
  }

  let tokenBeforeComments = source.getTokenBefore(firstComment)

  let slicingPointer = tokenBeforeComments && getOffsetBetweenLocations(tokenBeforeComments.loc, firstComment.loc) === 0 ? 1 : 0

  for (let [i, comment] of nextComments.entries()) {
    let previousComment = nextComments[i - 1]

    if (previousComment && getOffsetBetweenLocations(previousComment.loc, comment.loc) !== 1) {
      slicingPointer += 1
    }
  }

  return comments.slice(slicingPointer)
}