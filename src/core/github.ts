/**
 * 从 GitHub API 获取指定仓库的最新 Release Tag。
 * @param repo - 仓库名称，格式为 "owner/repo"。
 * @returns 返回最新的 release tag 名称。
 * @throws 如果 API 请求失败，则抛出错误。
 */
export const getLatestReleaseTag = async (repo: string): Promise<string> => {
  const url = `https://api.github.com/repos/${repo}/releases/latest`;
  const res = await fetch(url);

  if (!res.ok) {
    let errorDetails = "";
    try {
      // 尝试解析 GitHub API 返回的 JSON 错误详情
      const errorData = await res.json();
      const { message, documentation_url } = errorData as {
        message: string;
        documentation_url: string;
      };
      if (message) {
        errorDetails = `${message}\n@see ${documentation_url || "No URL provided"}`;
      } else {
        errorDetails = await res.text();
      }
    } catch {
      // 如果解析失败，回退到使用原始文本
      errorDetails = await res.text();
    }
    throw new Error(
      `Failed to fetch latest release tag for "${repo}": ${res.status} ${res.statusText}\n${errorDetails}`,
    );
  }

  const data = (await res.json()) as { tag_name: string };
  return data.tag_name;
};
