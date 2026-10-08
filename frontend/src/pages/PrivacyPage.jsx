import { Link } from 'react-router-dom'

const sections = [
  {
    title: '我们处理哪些数据',
    body: '你导入的小说正文、章节、书名和阅读/生成状态会发送到你连接的 Maneko 后端，并保存在该实例配置的数据库与文件目录中。移动端还会在本机保存 API 地址、阅读偏好以及少量界面状态。应用没有账号系统。',
  },
  {
    title: 'AI 服务与内容传输',
    body: '当后端配置了相应服务时，小说正文可能发送给 DashScope/Qwen 用于分章；章节内容及生成提示会发送给部署者配置的图像模型（例如 Qwen、Wanx 或 MiMo）生成分镜。实际供应商由后端运营者配置。供应商如何处理数据、跨境传输及保留期限以其现行政策和你的服务部署协议为准。',
  },
  {
    title: '存储、删除与保留',
    body: '删除书籍会删除服务端书籍和章节记录，并尝试删除该书章节对应的漫画图片；这不等同于立即清除部署者的备份、基础设施日志或第三方模型服务中的副本。实例运营者负责配置存储、备份、日志和保留期限。浏览器本地偏好可通过应用的“重置本地数据”清除。',
  },
  {
    title: '访问控制与公开部署',
    body: '当前后端没有用户账号或按用户隔离的数据权限，属于个人/受控部署架构。不要将未配置网络访问控制的后端作为公开多人共享服务；连接公共实例前，请确认运营者和其数据处理方式。',
  },
  {
    title: '分析、广告与未成年人',
    body: '当前代码未集成广告 SDK、跨应用跟踪或产品分析 SDK。托管平台仍可能记录运行所需的连接日志。请勿上传你无权处理的个人信息、受版权保护内容或违法内容；未成年人请在监护人指导下使用。',
  },
]

function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm md:p-10">
      <Link to="/" className="text-sm font-semibold text-[var(--color-accent)] underline underline-offset-4">← 返回 Maneko</Link>
      <p className="mt-8 text-xs font-semibold tracking-wide text-[var(--color-muted)]">隐私与数据说明 · 更新于 2026-10-09</p>
      <h1 className="mt-2 text-3xl font-bold">你的小说由你选择的服务处理</h1>
      <p className="mt-4 leading-7 text-[var(--color-muted)]">Maneko 是小说阅读与漫画分镜创作工具。此说明描述仓库当前实现；如果你使用他人托管的后端，运营者的实际处理方式也适用。部署者应在发布前补充运营主体、联系渠道和公开政策 URL。</p>
      <div className="mt-8 space-y-7">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-lg font-bold">{section.title}</h2>
            <p className="mt-2 leading-7 text-[var(--color-muted)]">{section.body}</p>
          </section>
        ))}
      </div>
      <p className="mt-8 border-t border-[var(--color-border)] pt-5 text-sm leading-6 text-[var(--color-muted)]">
        联系方式须由应用发布者填写并在公开隐私政策中提供。此仓库模板不是法律意见；上架前请按实际托管、供应商、地区和商店问卷复核。
      </p>
    </article>
  )
}

export default PrivacyPage
