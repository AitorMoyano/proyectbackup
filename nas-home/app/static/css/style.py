body {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
}

.card {
    border: none;
    border-radius: 15px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    transition: transform 0.3s;
}

.card:hover {
    transform: translateY(-5px);
}

.btn-primary {
    background: linear-gradient(45deg, #667eea, #764ba2);
    border: none;
    border-radius: 25px;
    padding: 10px 30px;
}

.list-group-item {
    border: none;
    border-radius: 10px;
    margin-bottom: 10px;
    background: #f8f9fa;
}

.status-completed { color: #28a745; font-weight: bold; }
.status-failed { color: #dc3545; font-weight: bold; }
.status-restored { color: #ffc107; font-weight: bold; }

.navbar-brand {
    font-size: 1.5rem;
}

#disk-usage {
    height: 20px;
    background: #e0e0e0;
    border-radius: 10px;
    overflow: hidden;
}

#disk-progress {
    height: 100%;
    background: linear-gradient(90deg, #28a745, #20c997);
    transition: width 0.3s;
}

.progress-bar-raid {
    background: linear-gradient(45deg, #17a2b8, #20c997);
}