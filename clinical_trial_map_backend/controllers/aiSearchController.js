const { answerTrialQuestion } = require("../services/aiQuestionService");

async function postAISearch(req, res) {
  try {
    const { question, pageSize = 20, pageToken = "", contextFilters = {}, conversationContext = {} } = req.body;

    if (typeof question !== "string" || !question.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide a search question.",
      });
    }

    if (!contextFilters || typeof contextFilters !== "object" || Array.isArray(contextFilters)) {
      return res.status(400).json({
        success: false,
        message: "contextFilters must be an object.",
      });
    }
    if (!conversationContext || typeof conversationContext !== "object" || Array.isArray(conversationContext)) {
      return res.status(400).json({ success: false, message: "conversationContext must be an object." });
    }

    const parsedPageSize = Number(pageSize);

    if (
      !Number.isInteger(parsedPageSize) ||
      parsedPageSize < 1 ||
      parsedPageSize > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "pageSize must be an integer between 1 and 100.",
      });
    }

    if (typeof pageToken !== "string") {
      return res.status(400).json({
        success: false,
        message: "pageToken must be a string.",
      });
    }

    const result = await answerTrialQuestion(
      question.trim(),
      parsedPageSize,
      pageToken,
      contextFilters,
      conversationContext,
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("AI trial search failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "AI clinical trial search failed.",

    });
  }
}

module.exports = { postAISearch };
