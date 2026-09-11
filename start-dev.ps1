Write-Host "Starting backend on port 8001..."
$backend = Start-Process -FilePath "py" -ArgumentList "-3.11 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8001" -WorkingDirectory "D:\idea_java_project\Agent\agent-scope-dev\backend" -PassThru
Write-Host "Backend PID: $($backend.Id)"

Write-Host "Starting frontend on port 5173..."
$frontend = Start-Process -FilePath "npx" -ArgumentList "vite --host 0.0.0.0 --port 5173" -WorkingDirectory "D:\idea_java_project\Agent\agent-scope-dev\frontend" -PassThru
Write-Host "Frontend PID: $($frontend.Id)"

Write-Host ""
Write-Host "Services started!"
Write-Host "  Backend:  http://localhost:8001"
Write-Host "  Frontend: http://localhost:5173"
Write-Host ""
Write-Host "Press any key to stop..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue
